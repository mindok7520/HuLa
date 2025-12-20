use crate::error::CommonError;

use entity::im_contact;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, IntoActiveModel, QueryFilter,
    Set, TransactionTrait,
};
use tracing::info;

pub async fn list_contact(
    db: &DatabaseConnection,
    login_uid: &str,
) -> Result<Vec<im_contact::Model>, CommonError> {
    info!("Querying database to get all conversations");
    let list = im_contact::Entity::find()
        .filter(im_contact::Column::LoginUid.eq(login_uid))
        .all(db)
        .await?;
    Ok(list)
}

/// 대화 데이터를 로컬 데이터베이스에 일괄 저장
pub async fn save_contact_batch(
    db: &DatabaseConnection,
    contacts: Vec<im_contact::Model>,
    login_uid: &str,
) -> Result<(), CommonError> {
    if contacts.is_empty() {
        return Ok(());
    }

    // 트랜잭션을 사용하여 작업의 원자성 보장
    let txn = db.begin().await?;

    // 현재 사용자의 기존 대화 데이터를 먼저 삭제
    im_contact::Entity::delete_many()
        .filter(im_contact::Column::LoginUid.eq(login_uid))
        .exec(&txn)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to delete existing contact data: {}", e))?;

    // 새로운 대화 데이터 일괄 삽입
    let active_models: Vec<im_contact::ActiveModel> = contacts
        .into_iter()
        .map(|mut contact| {
            contact.login_uid = login_uid.to_string();
            let active_model = contact.into_active_model();
            active_model
        })
        .collect();

    if !active_models.is_empty() {
        im_contact::Entity::insert_many(active_models)
            .exec(&txn)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to batch insert contact data: {}", e))?;
    }

    // 트랜잭션 커밋
    txn.commit().await?;
    Ok(())
}

/// 연락처 숨김 상태 업데이트
pub async fn update_contact_hide(
    db: &DatabaseConnection,
    room_id: &str,
    hide: bool,
    login_uid: &str,
) -> Result<(), CommonError> {
    info!(
        "Updating contact hide status: room_id={}, hide={}, login_uid={}",
        room_id, hide, login_uid
    );

    // 해당 연락처 레코드 찾기
    let contact = im_contact::Entity::find()
        .filter(im_contact::Column::RoomId.eq(room_id))
        .filter(im_contact::Column::LoginUid.eq(login_uid))
        .one(db)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to find contact record: {}", e))?;

    if let Some(contact) = contact {
        let mut active_model: im_contact::ActiveModel = contact.into_active_model();
        active_model.hide = Set(Some(hide));

        active_model
            .update(db)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to update contact hide status: {}", e))?;

        info!("Successfully updated contact hide status");
    }

    Ok(())
}
