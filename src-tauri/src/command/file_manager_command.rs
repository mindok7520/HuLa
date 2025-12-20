use crate::AppData;
use crate::repository::im_message_repository::{self, MessageWithThumbnail};
use entity::im_message;
use sea_orm::{ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder, QuerySelect};

use serde::{Deserialize, Serialize};
use std::ops::Deref;
use tauri::State;
use tracing::info;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub id: String,
    pub file_name: String,
    pub file_size: i64,
    pub file_type: String,
    pub upload_time: String,
    pub sender: UserInfo,
    pub download_url: Option<String>,
    pub is_downloaded: Option<bool>,
    pub status: String, // "uploading", "completed", "expired", "downloading"
    pub thumbnail_url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub id: String,
    pub name: String,
    pub avatar: String,
    pub is_online: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TimeGroup {
    pub date: String,
    pub display_date: String,
    pub files: Vec<FileInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NavigationItem {
    pub key: String,
    pub label: String,
    pub icon: String,
    pub active: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileQueryParam {
    pub navigation_type: String, // "myFiles", "senders", "sessions"
    pub selected_user: Option<String>,
    pub search_keyword: Option<String>,
    pub room_id: Option<String>,
    pub page: u32,
    pub page_size: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileQueryResponse {
    pub time_grouped_files: Vec<TimeGroup>,
    pub user_list: Vec<UserInfo>,
    pub has_more: bool,
    pub current_page: u32,
}

/// 파일 조회를 위한 Tauri 명령
#[tauri::command]
pub async fn query_files(
    param: FileQueryParam,
    state: State<'_, AppData>,
) -> Result<FileQueryResponse, String> {
    // 현재 로그인한 사용자의 uid 가져오기
    let login_uid = {
        let user_info = state.user_info.lock().await;
        user_info.uid.clone()
    };

    // 조회 조건 구축 - 파일 유형의 메시지만 조회
    let _query_condition = crate::command::chat_history_command::ChatHistoryQueryCondition {
        room_id: param.room_id.clone().unwrap_or_default(),
        login_uid: login_uid.clone(),
        message_type: Some(vec![4, 6]), // 파일, 비디오 유형
        search_keyword: param.search_keyword.clone(),
        sort_order: crate::command::chat_history_command::SortOrder::Desc,
        date_range: None,
        pagination: crate::command::chat_history_command::PaginationParam {
            page: param.page,
            page_size: param.page_size,
        },
    };

    // 데이터베이스 조회
    let messages = match param.navigation_type.as_str() {
        "myFiles" => {
            // 모든 방의 파일 조회
            query_all_files(state.db_conn.deref(), &login_uid, &param).await?
        }
        "senders" => {
            // 발신자별로 그룹화하여 파일 조회
            query_files_by_senders(state.db_conn.deref(), &login_uid, &param).await?
        }
        "sessions" | "groups" => {
            // 세션 또는 그룹 채팅별로 그룹화하여 파일 조회
            query_files_by_sessions(state.db_conn.deref(), &login_uid, &param).await?
        }
        _ => {
            return Err("지원되지 않는 내비게이션 유형입니다".to_string());
        }
    };

    // 파일 정보로 변환
    let file_infos: Vec<FileInfo> = messages
        .into_iter()
        .filter_map(|msg| convert_message_to_file_info(msg))
        .collect();

    // 사용자 목록 추출
    let user_list = extract_user_list(&file_infos);

    // 검색 키워드로 필터링
    let filtered_files: Vec<FileInfo> = if let Some(keyword) = &param.search_keyword {
        file_infos
            .into_iter()
            .filter(|file| {
                file.file_name
                    .to_lowercase()
                    .contains(&keyword.to_lowercase())
            })
            .collect()
    } else {
        file_infos
    };

    let total_filtered_files = filtered_files.len();

    // 시간별로 그룹화
    let time_grouped_files = group_files_by_time(filtered_files);

    let has_more = total_filtered_files >= param.page_size as usize;

    let response = FileQueryResponse {
        time_grouped_files,
        user_list,
        has_more,
        current_page: param.page,
    };

    Ok(response)
}

/// 모든 파일 조회
async fn query_all_files(
    db_conn: &sea_orm::DatabaseConnection,
    login_uid: &str,
    param: &FileQueryParam,
) -> Result<Vec<MessageWithThumbnail>, String> {
    im_message_repository::query_file_messages(
        db_conn,
        login_uid,
        None,          // 모든 방 조회
        Some(&[4, 6]), // 파일, 비디오 유형
        param.search_keyword.as_deref(),
        param.page,
        param.page_size,
    )
    .await
    .map_err(|e| e.to_string())
}

/// 발신자별 파일 조회
async fn query_files_by_senders(
    db_conn: &sea_orm::DatabaseConnection,
    login_uid: &str,
    param: &FileQueryParam,
) -> Result<Vec<MessageWithThumbnail>, String> {
    // 연락처가 지정된 경우 해당 연락처와 관련된 모든 파일 조회
    if let Some(contact_uid) = &param.selected_user {
        // 새로운 전략: 메시지 상호작용 기록을 기반으로 공통 방 찾기
        // 1. 대상 연락처와 관련된 모든 메시지를 찾아 중복되지 않는 방 ID 가져오기
        let contact_messages = im_message::Entity::find()
            .filter(im_message::Column::LoginUid.eq(login_uid))
            .filter(im_message::Column::Uid.eq(contact_uid))
            .all(db_conn)
            .await
            .map_err(|e| format!("연락처 메시지 조회 실패: {}", e))?;

        // 중복되지 않는 방 ID 추출
        let mut room_ids: std::collections::HashSet<String> = std::collections::HashSet::new();
        for message in contact_messages {
            room_ids.insert(message.room_id);
        }

        // 2. 이 방들에서 파일 메시지 조회
        let mut relevant_messages = Vec::new();

        for room_id in room_ids {
            // 해당 방의 파일 메시지 조회
            let room_files = im_message_repository::query_file_messages(
                db_conn,
                login_uid,
                Some(&room_id), // 지정된 방
                Some(&[4, 6]),  // 파일, 비디오 유형
                param.search_keyword.as_deref(),
                param.page,
                param.page_size,
            )
            .await
            .map_err(|e| e.to_string())?;

            relevant_messages.extend(room_files);
        }

        Ok(relevant_messages)
    } else {
        // 연락처가 지정되지 않은 경우 모든 파일 조회
        query_all_files(db_conn, login_uid, param).await
    }
}

/// 세션별 파일 조회
async fn query_files_by_sessions(
    db_conn: &sea_orm::DatabaseConnection,
    login_uid: &str,
    param: &FileQueryParam,
) -> Result<Vec<MessageWithThumbnail>, String> {
    // 방 ID가 지정된 경우 해당 방의 파일을 조회하고, 그렇지 않으면 모든 방을 조회함
    let room_id = param.room_id.as_deref();

    im_message_repository::query_file_messages(
        db_conn,
        login_uid,
        room_id,
        Some(&[4, 6]), // 파일, 비디오 유형
        param.search_keyword.as_deref(),
        param.page,
        param.page_size,
    )
    .await
    .map_err(|e| e.to_string())
}

/// 메시지를 파일 정보로 변환
fn convert_message_to_file_info(record: MessageWithThumbnail) -> Option<FileInfo> {
    let MessageWithThumbnail {
        message,
        thumbnail_path,
    } = record;

    // 메시지 본문에서 파일 정보 파싱
    if let Some(body) = &message.body {
        // JSON으로 파싱 시도
        match serde_json::from_str::<serde_json::Value>(body) {
            Ok(file_data) => {
                // 메시지 유형이 파일 유형인지 확인
                let message_type = message.message_type.unwrap_or(0);
                if message_type != 4 && message_type != 6 {
                    return None;
                }

                // 파일 이름 가져오기 시도, fileName을 우선 사용하며 내역 데이터 호환 유지, 비디오 메시지는 URL에서 추출
                let file_name = file_data["fileName"].as_str().or_else(|| {
                    // 비디오 메시지의 경우 URL에서 파일 이름 추출
                    if message_type == 6 {
                        file_data["url"].as_str().and_then(|url| {
                            url.split('/')
                                .last()
                                .map(|s| s.split('?').next().unwrap_or(s))
                        })
                    } else {
                        None
                    }
                });

                let file_name = match file_name {
                    Some(name) => name.to_string(),
                    None => {
                        return None;
                    }
                };
                let file_size = extract_file_size(&file_data).unwrap_or(0);

                let file_type = get_file_type_from_message_type(message_type);
                let upload_time = message.send_time.unwrap_or(0);

                let sender = UserInfo {
                    id: message.uid.clone(),
                    name: message.nickname.clone().unwrap_or("알 수 없는 사용자".to_string()),
                    avatar: "/avatars/default.jpg".to_string(),
                    is_online: None,
                };

                let file_info = FileInfo {
                    id: message.id.clone(),
                    file_name: file_name.clone(),
                    file_size,
                    file_type: file_type.clone(),
                    upload_time: format_timestamp(upload_time),
                    sender,
                    download_url: file_data["url"]
                        .as_str()
                        .or_else(|| file_data["downloadUrl"].as_str())
                        .map(|s| s.to_string()),
                    is_downloaded: Some(false),
                    status: "완료됨".to_string(),
                    thumbnail_url: thumbnail_path
                        .clone()
                        .or_else(|| file_data["thumbnailUrl"].as_str().map(|s| s.to_string())),
                };

                return Some(file_info);
            }
            Err(e) => {
                info!("메시지 본문이 유효한 JSON 형식이 아니어서 건너뜁니다: {}", e);
                // 不再创建假数据，直接返回 None
            }
        }
    } else {
        info!("메시지 본문이 비어 있습니다");
    }

    info!("메시지를 파일 정보로 변환할 수 없습니다");
    None
}

/// 메시지 본문에서 파일 크기 필드 파싱
fn extract_file_size(file_data: &serde_json::Value) -> Option<i64> {
    const SIZE_KEYS: [&str; 2] = ["fileSize", "size"];

    SIZE_KEYS
        .iter()
        .filter_map(|key| file_data.get(*key))
        .find_map(parse_size_value)
}

/// 파일 크기 값 파싱
fn parse_size_value(value: &serde_json::Value) -> Option<i64> {
    match value {
        serde_json::Value::Number(num) => num
            .as_i64()
            .or_else(|| num.as_u64().map(|n| (n.min(i64::MAX as u64)) as i64)),
        serde_json::Value::String(raw) => raw.trim().parse::<i64>().ok(),
        _ => None,
    }
}

/// 메시지 유형에 따라 파일 유형 가져오기
fn get_file_type_from_message_type(message_type: u8) -> String {
    match message_type {
        4 => "file".to_string(),
        6 => "video".to_string(),
        _ => "unknown".to_string(),
    }
}

/// 타임스탬프 형식화
fn format_timestamp(timestamp: i64) -> String {
    use chrono::{Local, TimeZone};

    if let Some(dt) = Local.timestamp_opt(timestamp / 1000, 0).single() {
        dt.format("%Y-%m-%d %H:%M:%S").to_string()
    } else {
        "알 수 없는 시간".to_string()
    }
}

/// 사용자 목록 추출
fn extract_user_list(files: &[FileInfo]) -> Vec<UserInfo> {
    let mut user_map = std::collections::HashMap::new();

    for file in files {
        user_map.insert(file.sender.id.clone(), file.sender.clone());
    }

    user_map.into_values().collect()
}

/// 파일을 시간별로 그룹화
fn group_files_by_time(files: Vec<FileInfo>) -> Vec<TimeGroup> {
    use chrono::NaiveDate;
    use std::collections::BTreeMap;

    let mut groups: BTreeMap<NaiveDate, Vec<FileInfo>> = BTreeMap::new();
    let mut unknown_files: Vec<FileInfo> = Vec::new();

    for file in files {
        if let Some(date_time) = parse_upload_time(&file.upload_time) {
            groups.entry(date_time.date()).or_default().push(file);
        } else {
            unknown_files.push(file);
        }
    }

    let mut time_groups: Vec<TimeGroup> = groups
        .into_iter()
        .rev()
        .map(|(date, mut files)| {
            files.sort_by(|a, b| b.upload_time.cmp(&a.upload_time));
            TimeGroup {
                date: date.format("%Y-%m-%d").to_string(),
                display_date: format_display_date(date),
                files,
            }
        })
        .collect();

    if !unknown_files.is_empty() {
        unknown_files.sort_by(|a, b| b.upload_time.cmp(&a.upload_time));
        time_groups.push(TimeGroup {
            date: "unknown".to_string(),
            display_date: "알 수 없는 시간".to_string(),
            files: unknown_files,
        });
    }

    time_groups
}

/// 업로드 시간 문자열을 NaiveDateTime으로 파싱
fn parse_upload_time(upload_time: &str) -> Option<chrono::NaiveDateTime> {
    chrono::NaiveDateTime::parse_from_str(upload_time, "%Y-%m-%d %H:%M:%S").ok()
}

/// 표시 날짜 형식화
fn format_display_date(date: chrono::NaiveDate) -> String {
    use chrono::{Datelike, Local};

    let today = Local::now().date_naive();
    let diff = today.signed_duration_since(date).num_days();

    if diff == 0 {
        "오늘".to_string()
    } else if diff == 1 {
        "어제".to_string()
    } else if today.year() == date.year() {
        date.format("%m월 %d일").to_string()
    } else {
        date.format("%Y년 %m월 %d일").to_string()
    }
}

/// 내비게이션 메뉴 항목 가져오기
#[tauri::command]
pub async fn get_navigation_items() -> Result<Vec<NavigationItem>, String> {
    let items = vec![
        NavigationItem {
            key: "myFiles".to_string(),
            label: "내 파일".to_string(),
            icon: "file".to_string(),
            active: true,
        },
        NavigationItem {
            key: "senders".to_string(),
            label: "발신자".to_string(),
            icon: "avatar".to_string(),
            active: false,
        },
        NavigationItem {
            key: "sessions".to_string(),
            label: "세션".to_string(),
            icon: "message".to_string(),
            active: false,
        },
        NavigationItem {
            key: "groups".to_string(),
            label: "그룹 채팅".to_string(),
            icon: "peoples".to_string(),
            active: false,
        },
    ];

    Ok(items)
}

/// 디버그 명령: 데이터베이스의 메시지 통계 정보 가져오기
#[tauri::command]
pub async fn debug_message_stats(state: State<'_, AppData>) -> Result<serde_json::Value, String> {
    let login_uid = {
        let user_info = state.user_info.lock().await;
        user_info.uid.clone()
    };

    // 查询总消息数
    let total_messages = im_message::Entity::find()
        .filter(im_message::Column::LoginUid.eq(&login_uid))
        .count(state.db_conn.deref())
        .await
        .map_err(|e| format!("총 메시지 수 조회 실패: {}", e))?;

    // 查询各种类型的消息数
    let mut stats = serde_json::Map::new();
    stats.insert(
        "total_messages".to_string(),
        serde_json::Value::Number(serde_json::Number::from(total_messages)),
    );

    // 다양한 메시지 유형 통계
    for msg_type in 0..=10u8 {
        let count = im_message::Entity::find()
            .filter(im_message::Column::LoginUid.eq(&login_uid))
            .filter(im_message::Column::MessageType.eq(msg_type))
            .count(state.db_conn.deref())
            .await
            .map_err(|e| format!("유형 {} 메시지 수 조회 실패: {}", msg_type, e))?;

        if count > 0 {
            stats.insert(
                format!("type_{}", msg_type),
                serde_json::Value::Number(serde_json::Number::from(count)),
            );
        }
    }

    // 최근 파일 메시지 샘플 조회
    let sample_messages = im_message::Entity::find()
        .filter(im_message::Column::LoginUid.eq(&login_uid))
        .filter(im_message::Column::MessageType.is_in([4, 6]))
        .order_by_desc(im_message::Column::SendTime)
        .limit(5)
        .all(state.db_conn.deref())
        .await
        .map_err(|e| format!("샘플 메시지 조회 실패: {}", e))?;

    let samples: Vec<serde_json::Value> = sample_messages
        .into_iter()
        .map(|msg| {
            serde_json::json!({
                "id": msg.id,
                "message_type": msg.message_type,
                "room_id": msg.room_id,
                "sender": msg.uid,
                "nickname": msg.nickname,
                "send_time": msg.send_time,
                "body_length": msg.body.as_ref().map(|b| b.len()).unwrap_or(0),
                "body_content": msg.body.as_ref().map(|b| {
                    if b.len() > 200 { format!("{}...", &b[..200]) } else { b.clone() }
                }).unwrap_or_else(|| "null".to_string()),
                "has_filename": msg.body.as_ref().and_then(|body| {
                    serde_json::from_str::<serde_json::Value>(body).ok()
                }).map(|json| {
                    json["fileName"].as_str()
                        .map(|name| !name.trim().is_empty())
                        .unwrap_or(false)
                }).unwrap_or(false)
            })
        })
        .collect();

    stats.insert(
        "sample_file_messages".to_string(),
        serde_json::Value::Array(samples),
    );

    Ok(serde_json::Value::Object(stats))
}
