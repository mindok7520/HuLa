use crate::error::CommonError;
use sea_orm::{ConnectionTrait, Database, DatabaseBackend, Statement};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

// SQLite 평문 파일 헤더 식별자, 암호화 라이브러리로의 마이그레이션이 필요한지 감지하는 데 사용됨
const SQLITE_HEADER: &[u8] = b"SQLite format 3\0";
// 시스템 키 저장소의 서비스 이름 (Keychain/Credential Manager 항목 이름)
const SQLCIPHER_KEY_SERVICE: &str = "com.hula.pc";
// 시스템 키 저장소의 계정 이름 (Keychain/Credential Manager 항목 이름)
const SQLCIPHER_KEY_ACCOUNT: &str = "hula_sqlcipher_key_v3";
// 환경 변수: SQLCipher 키 캐시 파일 경로 지정, 설정되지 않은 경우 app_data_dir/저장소 루트 디렉토리 사용
const SQLCIPHER_KEY_CACHE_ENV: &str = "HULA_SQLCIPHER_KEY_CACHE";
// 환경 변수: 1/true일 경우 Keychain/Keyring을 강제로 비활성화하고 로컬 캐시 또는 새로 생성된 키를 직접 사용 (모든 플랫폼 적용)
const SQLCIPHER_KEY_DISABLE_KEYCHAIN_ENV: &str = "HULA_SQLCIPHER_DISABLE_KEYCHAIN";
// 환경 변수: 1/true일 경우 macOS에서 Keychain 읽기 활성화 (팝업 방지를 위해 기본적으로 비활성화)
const SQLCIPHER_KEY_USE_KEYCHAIN_ENV: &str = "HULA_SQLCIPHER_USE_KEYCHAIN";

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

#[cfg(not(mobile))]
fn sqlcipher_key_cache_path(app_handle: &AppHandle) -> PathBuf {
    if let Ok(path) = std::env::var(SQLCIPHER_KEY_CACHE_ENV) {
        return PathBuf::from(path);
    }

    match app_handle.path().app_data_dir() {
        Ok(dir) => dir.join("sqlcipher.key"),
        Err(e) => {
            let fallback = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(".sqlcipher.key");
                "app_data_dir 가져오기 실패, 저장소 루트 디렉토리 캐시를 사용하여 SQLCipher 키 저장: {}",
            fallback
        }
    }
}

#[cfg(not(mobile))]
fn read_cached_sqlcipher_key(path: &Path) -> Option<String> {
    match fs::read_to_string(path) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Err(err) => {
            if err.kind() != std::io::ErrorKind::NotFound {
                tracing::warn!("읽기 SQLCipher 키 캐시 읽기 실패 {:?}: {}", path, err);
            }
            None
        }
    }
}

#[cfg(not(mobile))]
fn cache_sqlcipher_key(path: &Path, key: &str) {
    if let Some(parent) = path.parent() {
        if let Err(err) = fs::create_dir_all(parent) {
            tracing::warn!("SQLCipher 키 캐시 디렉토리 생성 실패 {:?}: {}", parent, err);
            return;
        }
    }

    if let Err(err) = fs::write(path, key) {
        tracing::warn!("SQLCipher 키 캐시 쓰기 실패 {:?}: {}", path, err);
        return;
    }

    #[cfg(unix)]
    if let Err(err) = fs::set_permissions(path, fs::Permissions::from_mode(0o600)) {
        tracing::warn!("SQLCipher 키 캐시설정 권한 실패 {:?}: {}", path, err);
    }
}

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
    app_handle: &AppHandle,
) -> Result<String, CommonError> {
    let cache_path = sqlcipher_key_cache_path(app_handle);
    tracing::info!("SQLCipher 키 캐시 경로: {:?}", cache_path);

    // Mac Keychain은 액세스할 때마다 팝업이 표시되므로, 환경 변수/로컬 캐시를 우선적으로 사용하여 중복 인증을 방지함
    if let Ok(env_key) = std::env::var("HULA_SQLCIPHER_KEY") {
        let trimmed = env_key.trim();
        if !trimmed.is_empty() {
            cache_sqlcipher_key(&cache_path, trimmed);
            return Ok(trimmed.to_string());
        }
    }

    // macOS는 빈번한 팝업을 피하기 위해 기본적으로 Keychain을 비활성화함. 명시적으로 활성화하거나 macOS가 아니고 비활성화되지 않은 경우 keyring을 계속 사용함.
    let disable_keychain_env = std::env::var(SQLCIPHER_KEY_DISABLE_KEYCHAIN_ENV)
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let use_keychain_env = std::env::var(SQLCIPHER_KEY_USE_KEYCHAIN_ENV)
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let should_use_keychain = if cfg!(target_os = "macos") {
        // macOS는 명시적으로 활성화된 경우에만 Keychain을 사용하며, 환경 변수가 팝업 동작을 제어하도록 함
        use_keychain_env
    } else {
        // 다른 플랫폼은 명시적으로 비활성화되지 않는 한 기본적으로 Keyring을 계속 사용함
        !disable_keychain_env
    };

    if should_use_keychain {
        tracing::info!("시스템 Keychain을 사용하여 SQLCipher 키 읽기 활성화 (캐시 파일 무시)");
        let entry = keyring::Entry::new(SQLCIPHER_KEY_SERVICE, SQLCIPHER_KEY_ACCOUNT)
            .map_err(|e| CommonError::RequestError(format!("시스템 키 저장소 초기화 실패: {}", e)))?;

        let value = match entry.get_password() {
            Ok(value) if !value.trim().is_empty() => value,
            _ => {
                let value = generate_sqlcipher_key();
                entry.set_password(&value).map_err(|e| {
                    CommonError::RequestError(format!("시스템 키 저장소 쓰기 실패: {}", e))
                })?;
                value
            }
        };

        return Ok(value);
    }

    tracing::info!("Keychain 비활성화됨, 로컬 캐시/새 키를 직접 사용");

    if let Some(cached) = read_cached_sqlcipher_key(&cache_path) {
        return Ok(cached);
    }

    let value = generate_sqlcipher_key();
    cache_sqlcipher_key(&cache_path, &value);
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
        "평문 SQLite 데이터베이스가 감지되었습니다. SQLCipher 암호화 라이브러리로 마이그레이션합니다: {:?}",
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

    // 일부 SQLCipher/플랫폼 조합에서는 ATTACH 시 새 파일이 자동으로 생성되지 않을 수 있으므로, 미리 생성하여 SQLITE_CANTOPEN을 방지함
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

    // WAL 모드에서는 디스크에 기록되지 않은 데이터가 있을 수 있으므로, 가능한 먼저 checkpoint를 수행함
    let _ = db.execute_unprepared("PRAGMA wal_checkpoint(FULL);").await;

    // 평문 라이브러리를 암호화 라이브러리로 내보내기 (SQLCipher 확장 기능)
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

    // 평문 백업 파일을 보관하지 않으며, 마이그레이션 완료 후 암호화 라이브러리로 원본 파일을 직접 대체함.
    // 주의: 일부 플랫폼(예: Windows)에서는 대상 파일이 이미 존재할 경우 rename이 실패할 수 있으므로, 평문 파일을 먼저 삭제한 후 이름을 변경해야 함.
    if let Err(rename_err) = std::fs::rename(&encrypted_path, db_path) {
        let should_retry = matches!(
            rename_err.kind(),
            std::io::ErrorKind::AlreadyExists | std::io::ErrorKind::PermissionDenied
        );

        if !should_retry {
            return Err(CommonError::RequestError(format!(
                "암호화 데이터베이스로 교체 실패 {:?} -> {:?}: {}",
                encrypted_path, db_path, rename_err
            )));
        }

        std::fs::remove_file(db_path).map_err(|e| {
            CommonError::RequestError(format!("평문 데이터베이스 삭제 실패 {:?}: {}", db_path, e))
        })?;

        std::fs::rename(&encrypted_path, db_path).map_err(|e| {
            CommonError::RequestError(format!(
                "암호화 데이터베이스로 교체 실패 {:?} -> {:?}: {}",
                encrypted_path, db_path, e
            ))
        })?;
    }

    tracing::info!(
        "SQLite 암호화 마이그레이션 완료, SQLCipher 암호화 라이브러리로 교체되었습니다: {:?}",
        db_path
    );
    Ok(())
}
