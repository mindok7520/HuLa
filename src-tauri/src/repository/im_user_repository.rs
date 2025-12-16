use crate::error::CommonError;
use entity::im_user;
use entity::prelude::ImUserEntity;
use sea_orm::{ActiveValue::Set, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter};
use tracing::{error, info};

/// 사용자의 is_init 상태 업데이트
pub async fn update_user_init_status<C>(
    db: &C,
    login_uid: &str,
    is_init: bool,
) -> Result<(), CommonError>
where
    C: ConnectionTrait,
{
    let user_update = im_user::ActiveModel {
        id: Set(login_uid.to_string()),
        is_init: Set(is_init),
        ..Default::default()
    };

    match ImUserEntity::update(user_update).exec(db).await {
        Ok(_) => {
            info!("User {} is_init status updated to {}", login_uid, is_init);
            Ok(())
        }
        Err(e) => {
            error!("Failed to update user is_init status: {:?}", e);
            Err(e.into())
        }
    }
}

/// 사용자의 토큰 정보 저장 또는 업데이트
pub async fn save_user_tokens<C>(
    db: &C,
    login_uid: &str,
    token: &str,
    refresh_token: &str,
) -> Result<(), CommonError>
where
    C: ConnectionTrait,
{
    // 사용자가 이미 존재하는지 확인
    let existing_user = ImUserEntity::find()
        .filter(im_user::Column::Id.eq(login_uid))
        .one(db)
        .await
        .map_err(|e| {
            error!("Failed to query user for token update: {:?}", e);
            CommonError::DatabaseError(e)
        })?;

    let user_update = if existing_user.is_some() {
        // 사용자 존재, 토큰 정보 업데이트
        im_user::ActiveModel {
            id: Set(login_uid.to_string()),
            token: Set(Some(token.to_string())),
            refresh_token: Set(Some(refresh_token.to_string())),
            ..Default::default()
        }
    } else {
        // 사용자 존재하지 않음, 새 사용자 생성 및 토큰 정보 설정
        im_user::ActiveModel {
            id: Set(login_uid.to_string()),
            token: Set(Some(token.to_string())),
            refresh_token: Set(Some(refresh_token.to_string())),
            is_init: Set(true), // 새 사용자는 기본적으로 초기화되지 않음
            ..Default::default()
        }
    };

    if existing_user.is_some() {
        // 기존 사용자 업데이트
        match ImUserEntity::update(user_update).exec(db).await {
            Ok(_) => {
                info!("User {} token info updated successfully", login_uid);
                Ok(())
            }
            Err(e) => {
                error!("Failed to update user token info: {:?}", e);
                Err(e.into())
            }
        }
    } else {
        // 새 사용자 삽입
        match ImUserEntity::insert(user_update).exec(db).await {
            Ok(_) => {
                info!("New user {} created with token info", login_uid);
                Ok(())
            }
            Err(e) => {
                error!("Failed to create user with token info: {:?}", e);
                Err(e.into())
            }
        }
    }
}

/// 사용자의 토큰 정보 가져오기
pub async fn get_user_tokens<C>(
    db: &C,
    login_uid: &str,
) -> Result<Option<(String, String)>, CommonError>
where
    C: ConnectionTrait,
{
    let user = ImUserEntity::find()
        .filter(im_user::Column::Id.eq(login_uid))
        .one(db)
        .await
        .map_err(|e| {
            error!("Failed to query user tokens: {:?}", e);
            CommonError::DatabaseError(e)
        })?;

    match user {
        Some(user) => {
            if let (Some(token), Some(refresh_token)) = (user.token, user.refresh_token) {
                Ok(Some((token, refresh_token)))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}
