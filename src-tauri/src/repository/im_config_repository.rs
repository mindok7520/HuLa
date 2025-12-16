use crate::error::CommonError;
use entity::im_config;
use sea_orm::QueryFilter;
use sea_orm::{ActiveModelTrait, ColumnTrait, IntoActiveModel, Set};
use sea_orm::{DatabaseConnection, EntityTrait, TransactionTrait};

/// 구성 목록 가져오기
pub async fn list_config(
    db: &DatabaseConnection,
    login_uid: &str,
) -> Result<Vec<im_config::Model>, CommonError> {
    let list = im_config::Entity::find()
        .filter(im_config::Column::LoginUid.eq(login_uid))
        .all(db)
        .await?;
    Ok(list)
}

/// 구성 키로 구성 값 가져오기
pub async fn get_config_by_key(
    db: &DatabaseConnection,
    config_key: &str,
    login_uid: &str,
) -> Result<Option<im_config::Model>, CommonError> {
    let config = im_config::Entity::find()
        .filter(im_config::Column::ConfigKey.eq(config_key))
        .filter(im_config::Column::LoginUid.eq(login_uid))
        .one(db)
        .await
        .map_err(|e| anyhow::anyhow!("구성 조회 실패: {}", e))?;
    Ok(config)
}

/// 구성 저장 또는 업데이트
pub async fn save_or_update_config(
    db: &DatabaseConnection,
    config_key: &str,
    config_value: Option<String>,
    login_uid: &str,
) -> Result<(), CommonError> {
    // 기존 구성 찾기
    let existing_config = get_config_by_key(db, config_key, login_uid).await?;

    if let Some(config) = existing_config {
        // 기존 구성 업데이트
        let mut config_active = config.into_active_model();
        config_active.config_value = Set(config_value);
        config_active.update(db).await?;
    } else {
        // 새 구성 생성
        let new_config = im_config::Model {
            id: 0, // 자동 증가 기본 키
            config_key: config_key.to_string(),
            config_value,
            login_uid: login_uid.to_string(),
        };
        let mut config_active = new_config.into_active_model();
        config_active.id = sea_orm::NotSet;
        config_active.insert(db).await?;
    }
    Ok(())
}

/// 구성 일괄 저장
pub async fn save_config_batch(
    db: &DatabaseConnection,
    configs: Vec<im_config::Model>,
    login_uid: &str,
) -> Result<(), CommonError> {
    if configs.is_empty() {
        return Ok(());
    }

    // 트랜잭션을 사용하여 작업의 원자성 보장
    let txn = db.begin().await?;

    // 먼저 현재 사용자의 기존 구성 데이터 삭제
    im_config::Entity::delete_many()
        .filter(im_config::Column::LoginUid.eq(login_uid))
        .exec(&txn)
        .await
        .map_err(|e| anyhow::anyhow!("기존 구성 데이터 삭제 실패: {}", e))?;

    // 새 구성 데이터 일괄 삽입
    let active_models: Vec<im_config::ActiveModel> = configs
        .into_iter()
        .map(|mut config| {
            config.login_uid = login_uid.to_string();
            let mut active_model = config.into_active_model();
            active_model.id = sea_orm::NotSet;
            active_model
        })
        .collect();

    if !active_models.is_empty() {
        im_config::Entity::insert_many(active_models)
            .exec(&txn)
            .await
            .map_err(|e| anyhow::anyhow!("구성 데이터 일괄 삽입 실패: {}", e))?;
    }

    // 트랜잭션 커밋
    txn.commit().await?;
    Ok(())
}

/// 구성 삭제
pub async fn delete_config(
    db: &DatabaseConnection,
    config_key: &str,
    login_uid: &str,
) -> Result<(), CommonError> {
    im_config::Entity::delete_many()
        .filter(im_config::Column::ConfigKey.eq(config_key))
        .filter(im_config::Column::LoginUid.eq(login_uid))
        .exec(db)
        .await
        .map_err(|e| anyhow::anyhow!("구성 삭제 실패: {}", e))?;
    Ok(())
}
