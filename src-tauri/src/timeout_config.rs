use std::time::Duration;

/// 애플리케이션 레벨의 타임아웃 설정
pub struct TimeoutConfig;

impl TimeoutConfig {
    /// 데이터베이스 연결 타임아웃
    pub const DATABASE_CONNECT_TIMEOUT: Duration = Duration::from_secs(30);

    /// 데이터베이스 작업 타임아웃
    pub const DATABASE_OPERATION_TIMEOUT: Duration = Duration::from_secs(120);

    /// HTTP 요청 타임아웃
    pub const HTTP_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);

    /// HTTP 연결 타임아웃
    pub const HTTP_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

    /// 디렉토리 스캔 타임아웃
    pub const DIRECTORY_SCAN_TIMEOUT: Duration = Duration::from_secs(300);

    /// 애플리케이션 초기화 타임아웃
    pub const APP_INIT_TIMEOUT: Duration = Duration::from_secs(60);

    /// 락(Lock) 획득 타임아웃
    pub const LOCK_ACQUIRE_TIMEOUT: Duration = Duration::from_millis(100);

    /// 토큰 새로고침 타임아웃
    pub const TOKEN_REFRESH_TIMEOUT: Duration = Duration::from_secs(30);
}

/// 비동기 작업에 타임아웃을 추가하는 보조 함수
pub async fn with_timeout<T, F>(
    future: F,
    timeout: Duration,
    operation_name: &str,
) -> Result<T, crate::error::CommonError>
where
    F: std::future::Future<Output = Result<T, crate::error::CommonError>>,
{
    match tokio::time::timeout(timeout, future).await {
        Ok(result) => result,
        Err(_) => {
            tracing::error!(
                "Operation '{}' timed out after {:?}",
                operation_name,
                timeout
            );
            Err(crate::error::CommonError::UnexpectedError(anyhow::anyhow!(
                "Operation '{}' timed out after {:?}",
                operation_name,
                timeout
            )))
        }
    }
}
