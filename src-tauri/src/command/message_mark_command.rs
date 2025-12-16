use std::collections::HashMap;
use std::collections::hash_map::Entry;

use crate::error::CommonError;
use crate::{AppData, command::message_command::MessageMark};
use entity::im_message;
use sea_orm::ColumnTrait;
use sea_orm::{EntityTrait, IntoActiveModel, QueryFilter, Set, TransactionTrait};
use serde::{Deserialize, Serialize};
use tauri::State;
use tracing::{error, info};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageMarkReq {
    msg_id: String,
    mark_type: i32,
    act_type: u8,
    uid: String,
    mark_count: u32,
}

/// 메시지 표시 저장 또는 업데이트
#[tauri::command]
pub async fn save_message_mark(
    data: ChatMessageMarkReq,
    state: State<'_, AppData>,
) -> Result<(), String> {
    let result: Result<(), CommonError> = async {
        let messages: Vec<im_message::Model> = im_message::Entity::find()
            .filter(im_message::Column::Id.eq(data.msg_id.clone()))
            .all(state.db_conn.as_ref())
            .await?;

        for message in messages {
            let message_marks = message.message_marks.clone();
            if let Some(message_marks) = message_marks {
                let new_message_marks = get_new_message_marks(
                    &message_marks,
                    data.mark_type.to_string(),
                    data.mark_count,
                    data.uid.clone(),
                    &message.login_uid,
                )?;

                // ActiveModel 생성, 업데이트할 필드만 설정
                let mut active_message = message.into_active_model();
                active_message.message_marks = Set(Some(new_message_marks));

                // 데이터베이스 업데이트
                im_message::Entity::update(active_message)
                    .exec(state.db_conn.as_ref())
                    .await?;
            }
        }

        // 트랜잭션을 시작하여 데이터베이스에 저장
        let tx = state.db_conn.begin().await?;
        // im_message_mark_repository::save_msg_mark(&tx, message_mark).await?;
        tx.commit().await?;

        info!(
            "메시지 표시 저장 성공, 메시지 ID: {}, 표시 유형: {}",
            &data.msg_id, data.mark_type
        );
        Ok(())
    }
    .await;

    match result {
        Ok(()) => Ok(()),
        Err(e) => {
            error!("Failed to save message mark: {:?}", e);
            Err(e.to_string())
        }
    }
}

fn get_new_message_marks(
    message_marks: &str,
    mark_type: String,
    mark_count: u32,
    uid: String,
    login_uid: &str,
) -> Result<String, CommonError> {
    let mut message_marks: HashMap<String, MessageMark> =
        serde_json::from_str::<HashMap<String, MessageMark>>(message_marks)
            .map_err(|e| anyhow::anyhow!("Failed to parse message marks: {}", e))?;

    match message_marks.entry(mark_type.clone()) {
        Entry::Occupied(entry) => {
            let message_mark = entry.into_mut();
            message_mark.count = mark_count;
            message_mark.user_marked = uid == login_uid;
        }
        Entry::Vacant(_) => {
            message_marks.insert(
                mark_type,
                MessageMark {
                    count: mark_count,
                    user_marked: uid == login_uid,
                },
            );
        }
    }

    let new_message_marks = serde_json::to_string(&message_marks)
        .map_err(|e| anyhow::anyhow!("메시지 표시 직렬화 오류: {}", e))?;
    Ok(new_message_marks)
}
