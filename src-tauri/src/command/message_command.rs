use crate::AppData;
use crate::error::CommonError;
use crate::im_request_client::{ImRequestClient, ImUrl};
use crate::pojo::common::{CursorPageParam, CursorPageResp};
use crate::repository::im_message_repository::MessageWithThumbnail;
use crate::repository::{im_message_repository, im_user_repository};
use crate::vo::vo::ChatMessageReq;

use entity::im_user::Entity as ImUserEntity;
use entity::{im_message, im_user};
use once_cell::sync::Lazy;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect};
use sea_orm::{DatabaseConnection, TransactionTrait};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::future::Future;
use std::ops::Deref;
use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};
use tauri::{State, ipc::Channel};
use tokio::sync::Mutex;
use tokio::time::{Duration, sleep};
use tracing::{debug, error, info, warn};

const WRITE_RETRY_LIMIT: usize = 3; // 쓰기 작업 최대 3회 재시도
const WRITE_RETRY_DELAY_MS: u64 = 80; // 재시도 기본 지연 80ms

async fn run_with_write_lock<T, F, Fut>(
    lock: Arc<Mutex<()>>, // 전역 쓰기 락을 전달하여 직렬 실행 보장
    op_name: &str,        // 현재 작업 이름 (로그용)
    mut operation: F,     // 실제 쓰기 로직
) -> Result<T, String>
where
    F: FnMut() -> Fut,                            // 비동기 쓰기 Future를 반환하는 클로저
    Fut: Future<Output = Result<T, CommonError>>, // 쓰기 결과 타입
{
    let mut attempt: usize = 0; // 현재 재시도 횟수
    loop {
        let guard = lock.lock().await; // 쓰기 락 획득
        let result = operation().await; // 실제 쓰기 실행
        drop(guard); // 쓰기 락 해제

        match result {
            Ok(val) => return Ok(val), // 성공 시 직접 반환
            Err(err) => {
                let err_msg = err.to_string(); // 오류 정보 기록
                let lowered = err_msg.to_lowercase(); // 대소문자 통일하여 매칭 편의
                let is_locked =
                    lowered.contains("database is locked") || lowered.contains("database is busy"); // 락 충돌 감지

                if is_locked && attempt + 1 < WRITE_RETRY_LIMIT {
                    let delay = WRITE_RETRY_DELAY_MS * (attempt as u64 + 1); // 증가 지연
                    warn!(
                        target: "tauri_db",
                        "[{}] database locked (attempt {}), retrying in {}ms",
                        op_name,
                        attempt + 1,
                        delay
                    );
                    attempt += 1; // 이번 재시도 기록
                    sleep(Duration::from_millis(delay)).await; // 지연 후 재시도
                    continue;
                }

                error!(target: "tauri_db", "[{}] database write failed: {}", op_name, err_msg);
                return Err(err_msg);
            }
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageResp {
    pub create_id: Option<String>,
    pub create_time: Option<i64>,
    pub update_id: Option<String>,
    pub update_time: Option<i64>,
    pub from_user: FromUser,
    pub message: Message,
    pub old_msg_id: Option<String>,
    pub time_block: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FromUser {
    pub uid: String,
    pub nickname: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: Option<String>,
    pub room_id: Option<String>,
    #[serde(rename = "type")]
    pub message_type: Option<u8>,
    pub body: Option<serde_json::Value>,
    pub message_marks: Option<HashMap<String, MessageMark>>,
    pub send_time: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UrlInfo {
    pub title: Option<String>,
    pub description: Option<String>,
    pub image: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MergeMessage {
    pub content: Option<String>,
    pub created_time: Option<i64>,
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ReplyMsg {
    pub id: Option<String>,
    pub uid: Option<String>,
    pub username: Option<String>,
    #[serde(rename = "type")]
    pub msg_type: Option<u8>,
    pub body: Option<Box<serde_json::Value>>,
    pub can_callback: u8,
    pub gap_count: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MessageMark {
    pub count: u32,
    pub user_marked: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorPageMessageParam {
    room_id: String,
    #[serde(flatten)]
    cursor_page_param: CursorPageParam,
}

#[tauri::command]
pub async fn page_msg(
    param: CursorPageMessageParam,
    state: State<'_, AppData>,
) -> Result<CursorPageResp<Vec<MessageResp>>, String> {
    // 현재 로그인한 사용자의 uid 가져오기
    let login_uid = {
        let user_info = state.user_info.lock().await;
        user_info.uid.clone()
    };

    // 데이터베이스에서 메시지 쿼리
    let db_result = im_message_repository::cursor_page_messages(
        state.db_conn.deref(),
        param.room_id,
        param.cursor_page_param,
        &login_uid,
    )
    .await
    .map_err(|e| e.to_string())?;

    // 데이터베이스 모델을 응답 모델로 변환
    let mut raw_list = db_result.list.unwrap_or_default();
    raw_list.sort_by(|a, b| {
        let a_time = a.message.send_time.unwrap_or(0);
        let b_time = b.message.send_time.unwrap_or(0);
        a_time.cmp(&b_time)
    });

    // 각 메시지의 time_block 계산
    let mut message_resps: Vec<MessageResp> = Vec::new();
    for (index, msg) in raw_list.into_iter().enumerate() {
        let mut resp = convert_message_to_resp(msg.clone(), None);

        // 첫 번째 메시지는 항상 시간 표시
        if index == 0 {
            resp.time_block = Some(1);
        } else if let Some(send_time) = msg.message.send_time {
            // 통일된 time_block 계산 함수 사용
            resp.time_block = im_message_repository::calculate_time_block(
                state.db_conn.deref(),
                &msg.message.room_id,
                &msg.message.id,
                send_time,
                &login_uid,
            )
            .await
            .map_err(|e| e.to_string())?;
        }

        message_resps.push(resp);
    }

    Ok(CursorPageResp {
        cursor: db_result.cursor,
        is_last: db_result.is_last,
        list: Some(message_resps),
        total: db_result.total,
    })
}

/// 데이터베이스 메시지 모델을 응답 모델로 변환
pub fn convert_message_to_resp(
    record: MessageWithThumbnail,
    old_msg_id: Option<String>,
) -> MessageResp {
    let MessageWithThumbnail {
        message: msg,
        thumbnail_path,
    } = record;

    // 解析消息体 - 安全地处理 JSON 解析
    let mut body = msg.body.as_ref().and_then(|body_str| {
        if body_str.trim().is_empty() {
            None
        } else {
            match serde_json::from_str(body_str) {
                Ok(parsed) => Some(parsed),
                Err(e) => {
                    debug!(
                        "Failed to parse message body JSON for message {}: {}",
                        msg.id, e
                    );
                    // 파싱 실패 시 원본 문자열을 텍스트 메시지로 처리
                    Some(serde_json::json!({
                        "content": body_str
                    }))
                }
            }
        }
    });

    inject_thumbnail_path(&mut body, thumbnail_path.as_deref());

    // 메시지 표시 파싱 - message_marks 필드에서 파싱 지원
    let message_marks = msg.message_marks.as_ref().and_then(|marks_str| {
        if marks_str.trim().is_empty() {
            return None;
        }

        match serde_json::from_str::<HashMap<String, MessageMark>>(marks_str) {
            Ok(parsed_marks) => {
                if parsed_marks.is_empty() {
                    None
                } else {
                    Some(parsed_marks)
                }
            }
            Err(e) => {
                debug!(
                    "Failed to parse message marks JSON for message {}: {}",
                    msg.id, e
                );
                None
            }
        }
    });

    // 응답 객체 구축
    MessageResp {
        create_id: Some(msg.id.clone()),
        create_time: msg.send_time,
        update_id: None,
        update_time: None,
        from_user: FromUser {
            uid: msg.uid,
            nickname: msg.nickname,
        },
        message: Message {
            id: Some(msg.id),
            room_id: Some(msg.room_id),
            message_type: msg.message_type,
            body,
            message_marks,
            send_time: msg.send_time,
        },
        old_msg_id: old_msg_id,
        time_block: msg.time_block,
    }
}

/// 사용자 초기화 상태 확인 및 메시지 가져오기
pub async fn check_user_init_and_fetch_messages(
    client: &mut ImRequestClient,
    db_conn: &DatabaseConnection,
    uid: &str,
    async_data: bool,
    force_full: bool,
) -> Result<(), CommonError> {
    // 고빈도 동기화 방지, 10초 내에 한 번만 동기화 허용(예: 약한 네트워크, 네트워크 불량 상황에서 반복 재연결)
    static MESSAGE_SYNC_LOCK: Lazy<tokio::sync::Mutex<()>> =
        Lazy::new(|| tokio::sync::Mutex::new(()));
    static LAST_MESSAGE_SYNC_MS: AtomicI64 = AtomicI64::new(0);
    const MESSAGE_SYNC_COOLDOWN_MS: i64 = 10_000;

    info!(
        "Checking user initialization status and fetching messages, uid: {}",
        uid
    );

    let now_ms = chrono::Utc::now().timestamp_millis();
    if !force_full {
        let last = LAST_MESSAGE_SYNC_MS.load(Ordering::Relaxed);
        if now_ms - last < MESSAGE_SYNC_COOLDOWN_MS {
            info!(
                "Skip message sync due to cooldown (last={}ms, now={}ms, uid={})",
                last, now_ms, uid
            );
            return Ok(());
        }
    }

    let guard = match MESSAGE_SYNC_LOCK.try_lock() {
        Ok(g) => g,
        Err(_) => {
            info!(
                "Skip message sync because another sync is in progress, uid={}",
                uid
            );
            return Ok(());
        }
    };

    // 사용자의 is_init 상태 확인
    if let Ok(user) = ImUserEntity::find()
        .filter(im_user::Column::Id.eq(uid))
        .one(db_conn)
        .await
    {
        if let Some(user_model) = user {
            let should_full_sync = force_full || user_model.is_init;
            // is_init이 true이면 백엔드 인터페이스를 호출하여 모든 메시지 가져오기; 그렇지 않으면 증분 모드로 동기화
            if should_full_sync {
                info!(
                    "User {} needs initialization, starting to fetch all messages",
                    uid
                );
                // 사용자의 async_data 매개변수 전달
                if let Err(e) = fetch_all_messages(client, db_conn, uid, async_data).await {
                    error!("Failed to fetch all messages: {}", e);
                    return Err(e);
                }
            } else {
                info!(
                    "User {} incremental/offline message update, async_data: {:?}",
                    uid, async_data
                );
                fetch_all_messages(client, db_conn, uid, async_data)
                    .await
                    .map_err(|e| {
                        error!("Failed to update offline messages: {}", e);
                        e
                    })?;
            }
        }
    }
    LAST_MESSAGE_SYNC_MS.store(now_ms, Ordering::Relaxed);
    drop(guard);
    Ok(())
}

// 모든 메시지를 가져와서 데이터베이스에 저장
pub async fn fetch_all_messages(
    client: &mut ImRequestClient,
    db_conn: &DatabaseConnection,
    uid: &str,
    async_data: bool,
) -> Result<(), CommonError> {
    info!(
        "Starting to fetch all messages, uid: {}, async_data: {:?}",
        uid, async_data
    );
    // 백엔드 인터페이스 /chat/msg/list를 호출하여 모든 메시지 가져오기, async_data 매개변수 전달
    let body = match async_data {
        true => Some(serde_json::json!({ "async": async_data })),
        false => None,
    };

    let messages: Option<Vec<MessageResp>> = client
        .im_request(ImUrl::GetMsgList, body, None::<serde_json::Value>)
        .await?;

    if let Some(mut messages) = messages {
        // 메시지 정렬 (전송 시간순)
        messages.sort_by(|a, b| {
            let a_time = a.message.send_time.unwrap_or(0);
            let b_time = b.message.send_time.unwrap_or(0);
            a_time.cmp(&b_time)
        });

        // time_block 일괄 계산 (먼저 계산, 그 다음 한 번에 DB에 쓰기)
        // DB의 마지막 메시지의 send_time을 시작점으로, 배치 내에서 하나씩 진행
        const TIME_BLOCK_THRESHOLD_MS: i64 = 1000 * 60 * 10;
        let mut last_send_time_map: HashMap<String, Option<i64>> = HashMap::new();

        for (_index, msg_resp) in messages.iter_mut().enumerate() {
            let room_id = match &msg_resp.message.room_id {
                Some(v) => v.clone(),
                None => continue,
            };
            let send_time = match msg_resp.message.send_time {
                Some(v) => v,
                None => continue,
            };

            // 해당 방의 이전 send_time 가져오기 (배치 내 최신 값 우선 사용, 그렇지 않으면 DB에서 한 번 가져오기)
            let prev_send_time = match last_send_time_map.get(&room_id) {
                Some(value) => *value,
                None => {
                    let last_time = im_message::Entity::find()
                        .filter(im_message::Column::RoomId.eq(&room_id))
                        .filter(im_message::Column::LoginUid.eq(uid))
                        .order_by_desc(im_message::Column::SendTime)
                        .select_only()
                        .column(im_message::Column::SendTime)
                        .into_tuple::<Option<i64>>()
                        .one(db_conn)
                        .await
                        .map_err(|e| anyhow::anyhow!("Failed to query last send_time: {}", e))?
                        .flatten();
                    last_send_time_map.insert(room_id.clone(), last_time);
                    last_time
                }
            };

            msg_resp.time_block = if let Some(prev) = prev_send_time {
                let gap = send_time - prev;
                if gap >= TIME_BLOCK_THRESHOLD_MS {
                    Some(gap)
                } else {
                    None
                }
            } else {
                // 방의 첫 번째 메시지는 항상 시간 표시
                Some(1)
            };

            // 현재 메시지가 다음 메시지의 참조가 됨
            last_send_time_map.insert(room_id, Some(send_time));
        }

        // 트랜잭션 시작
        let tx = db_conn.begin().await?;

        // MessageResp를 로컬 저장 모델로 변환
        let db_messages: Vec<MessageWithThumbnail> = messages
            .into_iter()
            .map(|msg_resp| convert_resp_to_record_for_fetch(msg_resp, uid.to_string()))
            .collect();
        // 로컬 데이터베이스에 저장
        match im_message_repository::save_all(&tx, db_messages).await {
            Ok(_) => {
                info!("Messages saved to database successfully");
            }
            Err(e) => {
                error!(
                    "Failed to save messages to database, detailed error: {:?}",
                    e
                );
                return Err(e.into());
            }
        }

        // 메시지 저장 완료 후 사용자의 is_init 상태를 false로 설정
        im_user_repository::update_user_init_status(&tx, uid, false)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to update user is_init status: {}", e))?;

        // 트랜잭션 커밋
        tx.commit().await?;
    }

    Ok(())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SyncMessagesParam {
    pub async_data: Option<bool>,
    pub full_sync: Option<bool>,
    pub uid: Option<String>,
}

#[tauri::command]
pub async fn sync_messages(
    param: Option<SyncMessagesParam>,
    state: State<'_, AppData>,
) -> Result<(), String> {
    use std::ops::Deref;

    let async_data = param.as_ref().and_then(|p| p.async_data).unwrap_or(true);
    let full_sync = param.as_ref().and_then(|p| p.full_sync).unwrap_or(false);
    let uid = match param.as_ref().and_then(|p| p.uid.clone()) {
        Some(v) if !v.is_empty() => v,
        _ => state.user_info.lock().await.uid.clone(),
    };

    let mut client = state.rc.lock().await;
    check_user_init_and_fetch_messages(
        &mut client,
        state.db_conn.deref(),
        &uid,
        async_data,
        full_sync,
    )
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// MessageResp를 데이터베이스 모델로 변환 (fetch_all_messages용)
fn convert_resp_to_record_for_fetch(msg_resp: MessageResp, uid: String) -> MessageWithThumbnail {
    use serde_json;

    // 메시지 본문을 JSON 문자열로 직렬화
    let body_json = msg_resp
        .message
        .body
        .as_ref()
        .and_then(|body| serde_json::to_string(body).ok());

    // 메시지 표시를 JSON 문자열로 직렬화
    let marks_json = msg_resp
        .message
        .message_marks
        .as_ref()
        .and_then(|marks| serde_json::to_string(marks).ok());

    let model = im_message::Model {
        id: msg_resp.message.id.unwrap_or_default(),
        uid: msg_resp.from_user.uid,
        nickname: msg_resp.from_user.nickname,
        room_id: msg_resp.message.room_id.unwrap_or_default(),
        message_type: msg_resp.message.message_type,
        body: body_json,
        message_marks: marks_json,
        send_time: msg_resp.message.send_time,
        create_time: msg_resp.create_time,
        update_time: msg_resp.update_time,
        login_uid: uid.to_string(),
        send_status: "success".to_string(),
        time_block: msg_resp.time_block,
    };

    let thumbnail_path = extract_thumbnail_path_from_body(&msg_resp.message.body);
    MessageWithThumbnail::new(model, thumbnail_path)
}

fn extract_thumbnail_path_from_body(body: &Option<serde_json::Value>) -> Option<String> {
    body.as_ref().and_then(|value| {
        value.as_object().and_then(|obj| {
            obj.get("thumbnailPath")
                .or_else(|| obj.get("thumbnail_path"))
                .and_then(|v| v.as_str().map(|s| s.to_string()))
        })
    })
}

fn inject_thumbnail_path(body: &mut Option<serde_json::Value>, path: Option<&str>) {
    let Some(path) = path else {
        return;
    };

    if path.is_empty() {
        return;
    }

    if let Some(val) = body {
        if let Some(map) = val.as_object_mut() {
            let exists = map
                .get("thumbnailPath")
                .and_then(|v| v.as_str())
                .map(|s| !s.is_empty())
                .unwrap_or(false);
            if !exists {
                map.insert(
                    "thumbnailPath".to_string(),
                    serde_json::Value::String(path.to_string()),
                );
            }
        }
    }
}

#[tauri::command]
pub async fn send_msg(
    data: ChatMessageReq,
    state: State<'_, AppData>,
    success_channel: Channel<MessageResp>,
    error_channel: Channel<String>,
) -> Result<(), String> {
    use std::ops::Deref;

    // 获取当前登录用户信息
    let (login_uid, nickname) = {
        let user_info = state.user_info.lock().await;
        (user_info.uid.clone(), None) // UserInfo는 uid와 token 필드만 있으므로 nickname은 임시로 None으로 설정
    };

    // 메시지 ID 생성
    let current_time = chrono::Utc::now().timestamp_millis();

    // 먼저 data를 복제하여 소유권 문제 회피
    let send_data = data.clone();

    // 메시지 본문 직렬화
    let body_json = data
        .body
        .as_ref()
        .and_then(|body| serde_json::to_string(body).ok());
    let thumbnail_path = extract_thumbnail_path_from_body(&data.body);

    // 메시지 모델 생성
    let message_model = im_message::Model {
        id: data.id.clone(),
        uid: login_uid.clone(),
        nickname,
        room_id: data.room_id.unwrap_or_default(),
        message_type: data.msg_type,
        body: body_json,
        message_marks: None,
        send_time: Some(current_time),
        create_time: Some(current_time),
        update_time: Some(current_time),
        login_uid: login_uid.clone(),
        send_status: "pending".to_string(), // 초기 상태는 pending
        time_block: None,
    };

    let mut message_record = MessageWithThumbnail::new(message_model, thumbnail_path);

    let write_lock = state.write_lock.clone(); // 克隆全局写锁句柄
    message_record = run_with_write_lock(write_lock, "send_msg", || {
        let db_conn = state.db_conn.clone(); // 데이터베이스 연결을 복제하여 비동기 사용
        let mut record = message_record.clone(); // 메시지 레코드를 복사하여 클로저 내에서 가변
        async move {
            let tx = db_conn.begin().await.map_err(CommonError::DatabaseError)?; // 트랜잭션 시작
            record = im_message_repository::save_message(&tx, record).await?; // 메시지 저장
            tx.commit().await.map_err(CommonError::DatabaseError)?; // 트랜잭션 커밋
            Ok(record)
        }
    })
    .await?;

    info!(
        "Message saved to local database, ID: {}",
        message_record.message.id.clone()
    );

    let msg_id = message_record.message.id.clone();

    // 비동기로 백엔드 인터페이스로 전송
    let db_conn = state.db_conn.clone();
    let request_client = state.rc.clone();
    let mut record_for_send = message_record.clone();

    tokio::spawn(async move {
        // 백엔드 인터페이스로 전송
        let result: Result<Option<MessageResp>, anyhow::Error> = {
            let mut client = request_client.lock().await;
            client
                .im_request(ImUrl::SendMsg, Some(send_data), None::<serde_json::Value>)
                .await
        };

        let mut id = None;

        // 전송 결과에 따라 메시지 상태 업데이트
        let status = match result {
            Ok(Some(mut resp)) => {
                resp.old_msg_id = Some(msg_id.clone());
                id = resp.message.id.clone();
                record_for_send.message.body = resp.message.body.as_ref().and_then(|body| {
                    if body.is_null() {
                        None
                    } else {
                        serde_json::to_string(body).ok()
                    }
                });
                if let Some(path) = extract_thumbnail_path_from_body(&resp.message.body) {
                    record_for_send.thumbnail_path = Some(path);
                }
                "success"
            }
            _ => "fail",
        };

        // 메시지 상태 업데이트
        let model = im_message_repository::update_message_status(
            db_conn.deref(),
            record_for_send,
            status,
            id,
            login_uid.clone(),
        )
        .await;

        match model {
            Ok(model) => {
                let resp = convert_message_to_resp(model, Some(msg_id));
                success_channel.send(resp).unwrap();
            }
            Err(e) => {
                error!("{:?}", e);
                error_channel.send(msg_id.clone()).unwrap();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn save_msg(data: MessageResp, state: State<'_, AppData>) -> Result<(), String> {
    // im_message::Model 생성
    let record = convert_resp_to_record_for_fetch(data, state.user_info.lock().await.uid.clone());

    let lock = state.write_lock.clone();
    run_with_write_lock(lock, "save_msg", || {
        let db_conn = state.db_conn.clone();
        let record = record.clone();
        async move {
            let tx = db_conn.begin().await?;
            im_message_repository::save_message(&tx, record).await?;
            tx.commit().await?;
            Ok(())
        }
    })
    .await?;

    Ok(())
}

#[tauri::command]
pub async fn update_message_recall_status(
    message_id: String,
    message_type: u8,
    message_body: String,
    state: State<'_, AppData>,
) -> Result<(), String> {
    let login_uid = state.user_info.lock().await.uid.clone();

    im_message_repository::update_message_recall_status(
        state.db_conn.deref(),
        &message_id,
        message_type,
        &message_body,
        &login_uid,
    )
    .await
    .map_err(|e| {
        error!("❌ [RECALL] Failed to update message recall status: {}", e);
        e.to_string()
    })?;

    Ok(())
}
#[tauri::command]
pub async fn delete_message(
    message_id: String,
    room_id: Option<String>,
    state: State<'_, AppData>,
) -> Result<(), String> {
    let login_uid = state.user_info.lock().await.uid.clone();

    let resolved_room_id = if let Some(room) = room_id {
        room
    } else {
        im_message_repository::get_room_id_by_message_id(
            state.db_conn.deref(),
            &message_id,
            &login_uid,
        )
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "메시지가 존재하지 않거나 방 정보가 누락됨".to_string())?
    };

    im_message_repository::delete_message_by_id(state.db_conn.deref(), &message_id, &login_uid)
        .await
        .map_err(|e| {
            error!("Failed to delete message {}: {}", message_id, e);
            e.to_string()
        })?;

    im_message_repository::record_deleted_message(
        state.db_conn.deref(),
        &message_id,
        &resolved_room_id,
        &login_uid,
    )
    .await
    .map_err(|e| {
        error!(
            "Failed to record deletion for message {} in room {}: {}",
            message_id, resolved_room_id, e
        );
        e.to_string()
    })?;

    info!(
        "Deleted message {} for current user {} from local database",
        message_id, login_uid
    );

    Ok(())
}

#[tauri::command]
pub async fn delete_room_messages(
    room_id: String,
    state: State<'_, AppData>,
) -> Result<u64, String> {
    let login_uid = state.user_info.lock().await.uid.clone();

    let last_msg_id =
        im_message_repository::get_room_max_message_id(state.db_conn.deref(), &room_id, &login_uid)
            .await
            .map_err(|e| {
                error!(
                    "Failed to query last message id for room {}: {}",
                    room_id, e
                );
                e.to_string()
            })?;

    let affected_rows =
        im_message_repository::delete_messages_by_room(state.db_conn.deref(), &room_id, &login_uid)
            .await
            .map_err(|e| {
                error!("Failed to delete messages for room {}: {}", room_id, e);
                e.to_string()
            })?;

    im_message_repository::record_room_clear(
        state.db_conn.deref(),
        &room_id,
        &login_uid,
        last_msg_id,
    )
    .await
    .map_err(|e| {
        error!(
            "Failed to record room clear for room {} (user {}): {}",
            room_id, login_uid, e
        );
        e.to_string()
    })?;

    info!(
        "Deleted {} messages for room {} (user {})",
        affected_rows, room_id, login_uid
    );

    Ok(affected_rows)
}
