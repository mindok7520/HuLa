use chrono;
use entity::{im_room, im_room_member};
use sea_orm::EntityTrait;
use sea_orm::IntoActiveModel;
use sea_orm::PaginatorTrait;
use sea_orm::QuerySelect;
use sea_orm::TransactionTrait;
use sea_orm::{ActiveModelTrait, Set};
use sea_orm::{ColumnTrait, DatabaseConnection, QueryFilter, QueryOrder};
use tracing::{debug, info};

use crate::pojo::common::{CursorPageParam, CursorPageResp};
use crate::{
    error::CommonError,
    pojo::common::{Page, PageParam},
};

pub async fn cursor_page_room_members(
    db: &DatabaseConnection,
    room_id: String,
    cursor_page_param: CursorPageParam,
    login_uid: &str,
) -> Result<CursorPageResp<Vec<im_room_member::Model>>, CommonError> {
    // 전체 개수 조회
    let total = im_room_member::Entity::find()
        .filter(im_room_member::Column::RoomId.eq(&room_id))
        .filter(im_room_member::Column::LoginUid.eq(login_uid))
        .count(db)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to query room member count: {}", e))?;

    let mut query = im_room_member::Entity::find()
        .filter(im_room_member::Column::RoomId.eq(room_id))
        .filter(im_room_member::Column::LoginUid.eq(login_uid))
        .order_by_desc(im_room_member::Column::LastOptTime)
        .limit(cursor_page_param.page_size as u64);

    // 커서가 제공된 경우 커서 값을 해석하고 필터 조건 추가
    if !cursor_page_param.cursor.is_empty() {
        // 커서에서 '_'를 기준으로 분할된 마지막 문자열을 i64로 변환
        let cursor_parts: Vec<&str> = cursor_page_param.cursor.split('_').collect();
        if let Some(last_part) = cursor_parts.last() {
            if let Ok(cursor_value) = last_part.parse::<i64>() {
                // 커서 값을 사용하여 필터링하고 해당 값보다 작은 레코드를 가져옴 (내림차순 정렬이므로)
                query = query.filter(im_room_member::Column::LastOptTime.lt(cursor_value));
            }
        }
    }

    let members = query
        .all(db)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to query room members: {}", e))?;

    // 다음 페이지 커서 구축 및 마지막 페이지 여부 판단
    let (next_cursor, is_last) = if members.len() < cursor_page_param.page_size as usize {
        // 반환된 레코드 수가 요청된 페이지 크기보다 적으면 마지막 페이지임을 의미함
        (String::new(), true)
    } else if let Some(last_member) = members.last() {
        // 마지막 레코드의 last_opt_time을 사용하여 다음 페이지 커서 구축
        let next_cursor = format!("{}", last_member.last_opt_time);
        (next_cursor, false)
    } else {
        (String::new(), true)
    };

    Ok(CursorPageResp {
        cursor: next_cursor,
        is_last,
        list: Some(members),
        total,
    })
}

pub async fn get_room_page(
    page_param: PageParam,
    db: &DatabaseConnection,
    login_uid: &str,
) -> Result<Page<im_room::Model>, CommonError> {
    // 오프셋 계산
    let offset = (page_param.current - 1) * page_param.size;

    // 전체 개수 조회
    let total = im_room::Entity::find()
        .filter(im_room::Column::LoginUid.eq(login_uid))
        .count(db)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to query room count: {}", e))?;

    // 페이지별 데이터 조회
    let records = im_room::Entity::find()
        .filter(im_room::Column::LoginUid.eq(login_uid))
        .offset(offset as u64)
        .limit(page_param.size as u64)
        .all(db)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to query room data: {}", e))?;

    Ok(Page {
        records,
        total: total.to_string(),
        size: page_param.size.to_string(),
    })
}

pub async fn save_room_batch(
    db: &DatabaseConnection,
    room_members: Vec<im_room::Model>,
    login_uid: &str,
) -> Result<(), CommonError> {
    use tokio::time::{Duration, timeout};

    // 장시간 잠금을 방지하기 위해 타임아웃 보호 추가
    let operation = async {
        // 트랜잭션을 사용하여 일괄 작업의 원자성 보장
        let txn = db.begin().await?;

        for mut member in room_members {
            // login_uid 설정
            member.login_uid = login_uid.to_string();

            // 레코드가 이미 존재하는지 확인
            let existing = im_room::Entity::find()
                .filter(im_room::Column::Id.eq(member.id.clone()))
                .filter(im_room::Column::LoginUid.eq(member.login_uid.clone()))
                .one(&txn)
                .await?;

            if existing.is_none() {
                // 레코드가 존재하지 않으면 삽입 실행
                let member_active = member.into_active_model();
                member_active
                    .insert(&txn)
                    .await
                    .map_err(|e| anyhow::anyhow!("Failed to insert room record: {}", e))?;
            }
            // 레코드가 이미 존재하면 삽입 건너뛰기
        }

        // 트랜잭션 커밋
        txn.commit()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to commit room batch transaction: {}", e))?;

        Ok(())
    };

    // 30초 타임아웃 설정
    match timeout(Duration::from_secs(30), operation).await {
        Ok(result) => result.map_err(CommonError::UnexpectedError),
        Err(_) => Err(CommonError::UnexpectedError(anyhow::anyhow!(
            "Room batch operation timed out after 30 seconds"
        ))),
    }
}

pub async fn get_room_members_by_room_id(
    room_id: &str,
    db: &DatabaseConnection,
    login_uid: &str,
) -> Result<Vec<im_room_member::Model>, CommonError> {
    let members = im_room_member::Entity::find()
        .filter(im_room_member::Column::RoomId.eq(room_id))
        .filter(im_room_member::Column::LoginUid.eq(login_uid))
        .all(db)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to query room members: {}", e))?;

    Ok(members)
}

pub async fn save_room_member_batch(
    db: &DatabaseConnection,
    room_members: Vec<im_room_member::Model>,
    room_id: i64,
    login_uid: &str,
) -> Result<(), CommonError> {
    use tokio::time::{Duration, timeout};

    // 장시간 잠금을 방지하기 위해 타임아웃 보호 추가
    let operation = async {
        // 트랜잭션을 사용하여 작업의 원자성 보장
        let txn: sea_orm::DatabaseTransaction = db.begin().await?;

        // 기존 데이터를 먼저 삭제 (더 효율적인 방식 사용)
        let delete_result = im_room_member::Entity::delete_many()
            .filter(im_room_member::Column::RoomId.eq(room_id.to_string()))
            .filter(im_room_member::Column::LoginUid.eq(login_uid))
            .exec(&txn)
            .await;

        match delete_result {
            Ok(_) => {
                debug!(
                    "Successfully deleted existing room members for room_id: {}, login_uid: {}",
                    room_id, login_uid
                );
            }
            Err(e) => {
                // 삭제 실패 시 트랜잭션 롤백
                let _ = txn.rollback().await;
                return Err(anyhow::anyhow!(
                    "Failed to delete existing room members: {}",
                    e
                ));
            }
        }

        // 새로운 room_members 데이터 저장 (일괄 삽입)
        if !room_members.is_empty() {
            let room_members_count = room_members.len(); // 이동 전에 길이 저장
            let active_models: Vec<im_room_member::ActiveModel> = room_members
                .into_iter()
                .map(|member| {
                    let mut member_active = member.into_active_model();
                    member_active.login_uid = Set(login_uid.to_string());
                    member_active.room_id = Set(Some(room_id.to_string()));
                    member_active
                })
                .collect();

            let insert_result = im_room_member::Entity::insert_many(active_models)
                .exec(&txn)
                .await;

            match insert_result {
                Ok(_) => {
                    debug!(
                        "Successfully inserted {} room members for room_id: {}",
                        room_members_count, room_id
                    );
                }
                Err(e) => {
                    // 삽입 실패 시 트랜잭션 롤백
                    let _ = txn.rollback().await;
                    return Err(anyhow::anyhow!("Failed to insert room members: {}", e));
                }
            }
        }

        // 트랜잭션 커밋
        txn.commit()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to commit transaction: {}", e))?;

        Ok(())
    };

    // 5초 타임아웃 설정
    match timeout(Duration::from_secs(5), operation).await {
        Ok(result) => result.map_err(CommonError::UnexpectedError),
        Err(_) => Err(CommonError::UnexpectedError(anyhow::anyhow!(
            "Database operation timed out after 5 seconds"
        ))),
    }
}

pub async fn update_my_room_info(
    db: &DatabaseConnection,
    my_name: &str,
    room_id: &str,
    uid: &str,
    login_uid: &str,
) -> Result<(), CommonError> {
    // room_id, uid, login_uid에 따라 방 멤버 레코드 찾기
    let member = im_room_member::Entity::find()
        .filter(im_room_member::Column::RoomId.eq(room_id))
        .filter(im_room_member::Column::Uid.eq(uid))
        .filter(im_room_member::Column::LoginUid.eq(login_uid))
        .one(db)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to query room member record: {}", e))?;

    if let Some(member) = member {
        debug!("Found room member record: {:?}", member);
        // 레코드를 찾으면 my_name 필드 업데이트
        let mut member_active = member.into_active_model();
        member_active.my_name = Set(Some(my_name.to_string()));

        member_active
            .update(db)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to update room member record: {}", e))?;
        info!("Successfully updated member room member information");
        Ok(())
    } else {
        // 레코드를 찾지 못하면 새 레코드 생성 (필수 필드만 포함)
        debug!(
            "Room member record not found, creating new record for room_id: {}, uid: {}",
            room_id, uid
        );

        let new_member = im_room_member::ActiveModel {
            id: Set(format!("{}_{}", room_id, uid)), // room_id + uid를 기본 키로 사용
            room_id: Set(Some(room_id.to_string())),
            uid: Set(Some(uid.to_string())),
            my_name: Set(Some(my_name.to_string())),
            login_uid: Set(login_uid.to_string()),
            last_opt_time: Set(chrono::Utc::now().timestamp()),
            name: Set(String::new()), // 기본 빈 값을 설정하며, 실제 이름은 다음 동기화 때 업데이트됨
            ..Default::default()
        };

        new_member
            .insert(db)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to insert new room member record: {}", e))?;

        info!("Successfully created new room member record with my_name");
        Ok(())
    }
}
