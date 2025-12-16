use std::time::Duration;

/// 애플리케이션 수준 시간 초과 구성
pub struct TimeoutConfig;

impl TimeoutConfig {
    /// 데이터베이스 연결 시간 초과
    pub const DATABASE_CONNECT_TIMEOUT: Duration = Duration::from_secs(30);

    /// 데이터베이스 작업 시간 초과
    pub const DATABASE_OPERATION_TIMEOUT: Duration = Duration::from_secs(120);

    /// HTTP 요청 시간 초과
    pub const HTTP_REQUEST_TIMEOUT: Duration = Duration::from_secs(60);

    /// HTTP 연결 시간 초과
    pub const HTTP_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

    /// 디렉토리 스캔 시간 초과
    pub const DIRECTORY_SCAN_TIMEOUT: Duration = Duration::from_secs(300);

    /// 애플리케이션 초기화 시간 초과
    pub const APP_INIT_TIMEOUT: Duration = Duration::from_secs(60);

    /// 잠금 획득 시간 초과
    pub const LOCK_ACQUIRE_TIMEOUT: Duration = Duration::from_millis(100);

    /// Token 갱신 시간 초과
    pub const TOKEN_REFRESH_TIMEOUT: Duration = Duration::from_secs(30);
}

/// 비동기 작업에 시간 초과를 추가하는 도우미 함수
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
