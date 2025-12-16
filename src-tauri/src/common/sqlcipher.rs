use crate::error::CommonError;
use sea_orm::{ConnectionTrait, Database, DatabaseBackend, Statement};
use std::fs::File;
use std::io::Read;
use std::path::Path;
use tauri::AppHandle;
use uuid::Uuid;

const SQLITE_HEADER: &[u8] = b"SQLite format 3\0";
const SQLCIPHER_KEY_SERVICE: &str = "com.hula.pc";
const SQLCIPHER_KEY_ACCOUNT: &str = "hula_sqlcipher_key_v3";

fn generate_sqlcipher_key() -> String {
    format!(
        "hula_{}{}",
        Uuid::new_v4().simple(),
        Uuid::new_v4().simple()
    )
}

fn is_plaintext_sqlite_file(db_path: &Path) -> Result<bool, CommonError> {
    let mut file = File::open(db_path).map_err(|e| {
        CommonError::RequestError(format!("sqlite 파일을 읽을 수 없습니다 {:?}: {}", db_path, e))
    })?;

    let mut header = [0u8; 16];
    let bytes_read = file.read(&mut header).map_err(|e| {
        CommonError::RequestError(format!("sqlite 파일 헤더를 읽을 수 없습니다 {:?}: {}", db_path, e))
    })?;

    Ok(bytes_read >= SQLITE_HEADER.len() && header.starts_with(SQLITE_HEADER))
}

fn cleanup_sqlite_sidecar_files(db_path: &Path) {
    let Some(file_name) = db_path.file_name().and_then(|v| v.to_str()) else {
        return;
    };

    for suffix in ["-wal", "-shm"] {
        let sidecar = db_path.with_file_name(format!("{file_name}{suffix}"));
        let _ = std::fs::remove_file(sidecar);
    }
}

fn escape_sqlite_single_quoted(value: &str) -> String {
    value.replace('\'', "''")
}

#[cfg(mobile)]
fn get_or_create_sqlcipher_key_from_secure_storage(
    app_handle: &AppHandle,
) -> Result<String, CommonError> {
    use tauri_plugin_hula::HulaExt;

    let payload = tauri_plugin_hula::SqliteKeyRequest {
        service: SQLCIPHER_KEY_SERVICE.to_string(),
        account: SQLCIPHER_KEY_ACCOUNT.to_string(),
    };

    let response = app_handle
        .hula()
        .get_or_create_sqlite_key(payload)
        .map_err(|e| CommonError::RequestError(format!("모바일 SQLite 키 가져오기 실패: {}", e)))?;

    Ok(response.key)
}

#[cfg(not(mobile))]
fn get_or_create_sqlcipher_key_from_secure_storage(
    _app_handle: &AppHandle,
) -> Result<String, CommonError> {
    let entry = keyring::Entry::new(SQLCIPHER_KEY_SERVICE, SQLCIPHER_KEY_ACCOUNT)
        .map_err(|e| CommonError::RequestError(format!("시스템 키 저장소 초기화 실패: {}", e)))?;

    if let Ok(value) = entry.get_password() {
        if !value.trim().is_empty() {
            return Ok(value);
        }
    }

    let value = generate_sqlcipher_key();
    entry
        .set_password(&value)
        .map_err(|e| CommonError::RequestError(format!("시스템 키 저장소 쓰기 실패: {}", e)))?;
    Ok(value)
}

pub async fn get_or_create_sqlcipher_key(app_handle: &AppHandle) -> Result<String, CommonError> {
    get_or_create_sqlcipher_key_from_secure_storage(app_handle)
}

pub async fn ensure_sqlite_encrypted(db_path: &Path, key: &str) -> Result<(), CommonError> {
    if !db_path.exists() {
        return Ok(());
    }

    if !is_plaintext_sqlite_file(db_path)? {
        return Ok(());
    }

    tracing::info!(
        "일반 텍스트 SQLite 데이터베이스가 감지되었습니다. SQLCipher 암호화 데이터베이스로 마이그레이션합니다: {:?}",
        db_path
    );

    let encrypted_path = db_path.with_extension("sqlite.enc");
    if encrypted_path.exists() {
        std::fs::remove_file(&encrypted_path).map_err(|e| {
            CommonError::RequestError(format!(
                "이전 임시 암호화 데이터베이스 삭제 실패 {:?}: {}",
                encrypted_path, e
            ))
        })?;
    }

    cleanup_sqlite_sidecar_files(db_path);
    cleanup_sqlite_sidecar_files(&encrypted_path);

    // 일부 SQLCipher/플랫폼 조합에서는 ATTACH가 새 파일을 자동으로 생성하지 않으므로, SQLITE_CANTOPEN을 방지하기 위해 미리 생성합니다.
    std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .open(&encrypted_path)
        .map_err(|e| {
            CommonError::RequestError(format!(
                "임시 암호화 데이터베이스 생성 실패 {:?}: {}",
                encrypted_path, e
            ))
        })?;

    let plain_url = format!("sqlite:{}?mode=rw", db_path.display());
    let db = Database::connect(plain_url).await?;

    // WAL 모드에서는 디스크에 기록되지 않은 데이터가 있을 수 있으므로 먼저 체크포인트를 수행합니다.
    let _ = db.execute_unprepared("PRAGMA wal_checkpoint(FULL);").await;

    // 일반 텍스트 데이터베이스를 암호화된 데이터베이스로 내보내기 (SQLCipher 확장 기능)
    let encrypted_path_sql = escape_sqlite_single_quoted(&encrypted_path.display().to_string());
    let key_sql = escape_sqlite_single_quoted(key);
    let attach_sql = format!(
        "ATTACH DATABASE '{}' AS encrypted KEY '{}';",
        encrypted_path_sql, key_sql
    );
    db.execute_unprepared(&attach_sql).await?;

    let export_sql = Statement::from_string(
        DatabaseBackend::Sqlite,
        "SELECT sqlcipher_export('encrypted');".to_string(),
    );
    let _ = db.query_one(export_sql).await?;

    db.execute_unprepared("DETACH DATABASE encrypted;").await?;
    db.close().await?;

    cleanup_sqlite_sidecar_files(db_path);
    cleanup_sqlite_sidecar_files(&encrypted_path);

    // 더 이상 일반 텍스트 백업 파일을 유지하지 않고, 마이그레이션 완료 후 암호화된 데이터베이스로 원본 파일을 직접 교체합니다.
    // 주의: 일부 플랫폼(예: Windows)에서는 대상 파일이 이미 존재할 때 이름 변경이 실패할 수 있으므로, 먼저 일반 텍스트 파일을 삭제한 다음 이름을 변경해야 합니다.
    if let Err(rename_err) = std::fs::rename(&encrypted_path, db_path) {
        let should_retry = matches!(
            rename_err.kind(),
            std::io::ErrorKind::AlreadyExists | std::io::ErrorKind::PermissionDenied
        );

        if !should_retry {
            return Err(CommonError::RequestError(format!(
                "암호화된 데이터베이스로 교체 실패 {:?} -> {:?}: {}",
                encrypted_path, db_path, rename_err
            )));
        }

        std::fs::remove_file(db_path).map_err(|e| {
            CommonError::RequestError(format!("일반 텍스트 데이터베이스 삭제 실패 {:?}: {}", db_path, e))
        })?;

        std::fs::rename(&encrypted_path, db_path).map_err(|e| {
            CommonError::RequestError(format!(
                "암호화된 데이터베이스로 교체 실패 {:?} -> {:?}: {}",
                encrypted_path, db_path, e
            ))
        })?;
    }

    tracing::info!(
        "SQLite 암호화 마이그레이션 완료, SQLCipher 암호화 데이터베이스로 교체됨: {:?}",
        db_path
    );
    Ok(())
}
