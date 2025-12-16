use crate::common::sqlcipher;
use crate::error::CommonError;
use sea_orm::{ConnectOptions, Database, DatabaseConnection};
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tracing::info;

// 애플리케이션 설정 구조체
#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct Settings {
    pub database: DatabaseSettings,
    pub backend: BackendSettings,
    pub youdao: Option<Youdao>,
    pub tencent: Option<Tencent>,
    pub minio: Option<MinioSettings>,
    pub ice_server: Option<IceServer>,
}

// 데이터베이스 구성 설정
#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct DatabaseSettings {
    pub sqlite_file: String,
}

// 백엔드 서비스 구성 설정
#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct BackendSettings {
    pub base_url: String,
    pub ws_url: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct Youdao {
    pub app_key: String,
    pub app_secret: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct IceServer {
    pub urls: Vec<String>,
    pub username: String,
    pub credential: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct Tencent {
    pub api_key: String,
    pub secret_id: String,
    pub map_key: String,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct MinioSettings {
    pub endpoint: String,
    pub bucket: String,
    pub access_key: String,
    pub secret_key: String,
    pub region: String,
    pub download_domain: String,
}

// 애플리케이션 실행 환경 열거형
#[derive(Debug)]
pub enum Environment {
    Local,
    Production,
}

impl DatabaseSettings {
    /// 데이터베이스 연결 생성
    /// 다양한 실행 환경(데스크톱 개발, 모바일, 데스크톱 프로덕션)에 따라 적절한 데이터베이스 경로 선택
    /// 데이터베이스 연결 옵션을 구성하고 데이터베이스 연결 인스턴스 반환
    ///
    /// # 매개변수
    /// * `app_handle` - 앱 경로를 가져오는 데 사용되는 Tauri 앱 핸들
    ///
    /// # 반환값
    /// * `Ok(DatabaseConnection)` - 成功时返回数据库连接
    /// * `Err(CommonError)` - 失败时返回错误信息
    pub async fn connection_string(
        &self,
        app_handle: &AppHandle,
    ) -> Result<DatabaseConnection, CommonError> {
        // 데이터베이스 경로 구성:
        let db_path = if cfg!(debug_assertions) && cfg!(desktop) {
            // 데스크톱 개발 환경: 프로젝트 루트 디렉토리 사용
            let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
            path.push("db.sqlite");
            path
        } else {
            // SQLite는 asset://localhost/와 같은 가상 프로토콜에 연결할 수 없으므로 실제 파일 시스템 경로를 사용해야 합니다.
            match app_handle.path().app_data_dir() {
                Ok(app_data_dir) => {
                    if let Err(create_err) = std::fs::create_dir_all(&app_data_dir) {
                        tracing::warn!("Failed to create app_data_dir: {}", create_err);
                    }
                    let db_path = app_data_dir.join("db.sqlite");
                    info!("Mobile: Using app_data_dir database path: {:?}", db_path);
                    db_path
                }
                Err(e) => {
                    let error_msg = format!("Mobile: Failed to get app_data_dir: {}", e);
                    tracing::error!("{}", error_msg);
                    return Err(CommonError::RequestError(error_msg).into());
                }
            }
        };
        info!("Database path: {:?}", db_path);

        // 장치 바인딩된 SQLCipher 키 (시스템 보안 저장소/Keychain/Keystore에 저장됨)
        let sqlcipher_key = sqlcipher::get_or_create_sqlcipher_key(app_handle).await?;
        // 이전 버전의 일반 텍스트 라이브러리와 호환: 처음 시작할 때 암호화된 라이브러리로 자동 마이그레이션
        sqlcipher::ensure_sqlite_encrypted(&db_path, &sqlcipher_key).await?;

        let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

        // 데이터베이스 연결 옵션 구성
        let mut opt = ConnectOptions::new(db_url);
        opt.sqlcipher_key(sqlcipher_key);
        opt.max_connections(20) // 리소스 낭비를 피하기 위해 최대 연결 수 감소
            .min_connections(2) // 최소 연결 수 감소
            .connect_timeout(Duration::from_secs(30)) // 연결 시간 초과 증가
            .acquire_timeout(Duration::from_secs(30)) // 연결 획득 시간 초과 증가
            .idle_timeout(Duration::from_secs(600)) // 10분 유휴 시간 초과
            .max_lifetime(Duration::from_secs(1800)) // 30분 연결 수명, 잦은 재구축 방지
            // SQL 로깅 활성화, 단 디버그 모드에서만
            .sqlx_logging(cfg!(debug_assertions))
            .sqlx_logging_level(tracing::log::LevelFilter::Info);

        let db: DatabaseConnection = Database::connect(opt)
            .await
            .map_err(|e| anyhow::anyhow!("Database connection failed: {}", e))?;
        Ok(db)
    }
}

impl Environment {
    /// Environment 열거형을 문자열로 변환
    /// 파일 이름 및 경로 구성에 사용됨
    ///
    /// # 반환값
    /// * `&'static str` - 对应的环境字符串
    pub fn as_str(&self) -> &'static str {
        match self {
            Environment::Local => "local",
            Environment::Production => "production",
        }
    }
}

impl TryFrom<String> for Environment {
    type Error = String;

    /// 문자열에서 Environment 열거형 파싱
    /// 대소문자를 구분하지 않는 파싱 지원
    ///
    /// # 매개변수
    /// * `s` - 要解析的字符串
    ///
    /// # 반환값
    /// * `Ok(Environment)` - 解析成功时返回环境枚举
    /// * `Err(String)` - 解析失败时返回错误信息
    fn try_from(s: String) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "local" => Ok(Self::Local),
            "production" => Ok(Self::Production),
            other => Err(format!(
                "{} is not a supported environment. Use either `local` or `production`.",
                other
            )),
        }
    }
}

/// 애플리케이션 구성 가져오기
/// APP_ENVIRONMENT 환경 변수에 따라 실행 환경을 결정하고 우선 순위에 따라 구성을 로드합니다.
/// 1. 데스크톱 개발 환경: 파일 시스템 구성 파일
/// 2. 기타 환경: 리소스 디렉토리 구성 파일
/// 3. 폴백: 컴파일 시 포함된 구성 파일
///
/// # 매개변수
/// * `app_handle` - Tauri应用句柄
///
/// # 반환값
/// * `Ok(Settings)` - 成功时返回配置设置
/// * `Err(config::ConfigError)` - 失败时返回配置错误
pub fn get_configuration(app_handle: &AppHandle) -> Result<Settings, config::ConfigError> {
    #[cfg(not(target_os = "android"))]
    {
        let is_desktop_dev = cfg!(debug_assertions) && cfg!(desktop);

        let config_path_buf = get_config_path_buf(app_handle, is_desktop_dev)?;

        let settings = config::Config::builder()
            .add_source(config::File::from(config_path_buf.0))
            .add_source(config::File::from(config_path_buf.1))
            .add_source(
                config::Environment::with_prefix("APP")
                    .prefix_separator("_")
                    .separator("__"),
            )
            .build()?;

        settings.try_deserialize::<Settings>()
    }

    #[cfg(target_os = "android")]
    {
        let _ = app_handle;
        // base.yaml 내용 읽기
        let base_content = std::str::from_utf8(include_bytes!("../configuration/base.yaml"))
            .map_err(|e| config::ConfigError::Message(e.to_string()))?;

        // base 구성 객체 빌드
        let base_config = config::Config::builder()
            .add_source(config::File::from_str(
                base_content,
                config::FileFormat::Yaml,
            ))
            .build()?;

        // active_config 필드 가져오기
        let active_config = base_config.get_string("active_config").map_err(|_| {
            config::ConfigError::Message(
                "Missing or invalid 'active_config' in base.yaml".to_string(),
            )
        })?;

        // active_config 유효성 검사
        if active_config != "local" && active_config != "production" {
            return Err(config::ConfigError::Message(
                "Only \"local\" or \"production\" can be specified in active_config".to_string(),
            ));
        }

        // 해당 구성 파일 내용 로드
        let config_file_bytes: &[u8] = match active_config.as_str() {
            "local" => include_bytes!("../configuration/local.yaml").as_ref(),
            "production" => include_bytes!("../configuration/production.yaml").as_ref(),
            _ => return Err(config::ConfigError::Message("Invalid active_config".into())), // 여기서 더 많은 환경 구성을 지원할 수 있음
        };

        let active_content = std::str::from_utf8(config_file_bytes)
            .map_err(|e| config::ConfigError::Message(e.to_string()))?;

        // 최종 구성 객체 빌드
        config::Config::builder()
            .add_source(config::File::from_str(
                base_content,
                config::FileFormat::Yaml,
            ))
            .add_source(config::File::from_str(
                active_content,
                config::FileFormat::Yaml,
            ))
            .add_source(
                config::Environment::with_prefix("APP")
                    .prefix_separator("_")
                    .separator("__"),
            )
            .build()?
            .try_deserialize::<Settings>()
    }
}

fn get_config_path_buf(
    app_handle: &AppHandle,
    is_desktop_dev: bool,
) -> Result<(PathBuf, PathBuf), config::ConfigError> {
    let dir = if is_desktop_dev {
        let base_path = std::env::current_dir().map_err(|e| {
            config::ConfigError::Message(format!("Failed to get current dir: {}", e))
        })?;

        base_path.join("configuration")
    } else {
        app_handle
            .path()
            .resource_dir()
            .map_err(|e| config::ConfigError::NotFound(format!("resource not find: {}", e)))?
            .join("configuration")
    };

    let base_path = dir.join("base.yaml");

    #[cfg(not(target_os = "android"))]
    let base_config = config::Config::builder()
        .add_source(config::File::from(base_path.clone()))
        .build()?;

    #[cfg(target_os = "android")]
    let base_config = {
        let content = std::str::from_utf8(include_bytes!("../configuration/base.yaml"))
            .map_err(|e| config::ConfigError::Message(e.to_string()))?;

        config::Config::builder()
            .add_source(config::File::from_str(content, config::FileFormat::Yaml))
            .build()?
    };

    let active_config = base_config.get_string("active_config")?;
    println!("active_config: {:?}", active_config);
    let active_config_path_buf = dir.clone().join(active_config);
    Ok((base_path, active_config_path_buf))
}
