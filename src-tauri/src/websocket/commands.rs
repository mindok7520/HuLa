use crate::AppData;

use super::{client::WebSocketClient, types::*};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, OnceLock};
use tauri::{AppHandle, State};
use tokio::sync::RwLock;
use tracing::{error, info};

// 전역 WebSocket 클라이언트 인스턴스
static GLOBAL_WS_CLIENT: OnceLock<Arc<RwLock<Option<WebSocketClient>>>> = OnceLock::new();

/// 전역 WebSocket 클라이언트 컨테이너 가져오기
pub fn get_websocket_client_container() -> &'static Arc<RwLock<Option<WebSocketClient>>> {
    GLOBAL_WS_CLIENT.get_or_init(|| {
        info!("Creating global WebSocket client container");
        Arc::new(RwLock::new(None))
    })
}

/// WebSocket 초기화 매개변수
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InitWsParams {
    pub client_id: String,
}

/// WebSocket 메시지 전송 매개변수
#[derive(Debug, Deserialize)]
pub struct SendMessageParams {
    pub data: serde_json::Value,
}

/// WebSocket 구성 업데이트 매개변수
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConfigParams {
    pub heartbeat_interval: Option<u64>,
    pub heartbeat_timeout: Option<u64>,
    pub max_reconnect_attempts: Option<u32>,
    pub reconnect_delay_ms: Option<u64>,
}

/// 성공 응답 구조체
#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub success: bool,
    pub message: Option<String>,
}

impl SuccessResponse {
    pub fn new() -> Self {
        Self {
            success: true,
            message: None,
        }
    }
}

/// WebSocket 연결 초기화
#[tauri::command]
pub async fn ws_init_connection(
    app_handle: AppHandle,
    params: InitWsParams,
    state: State<'_, AppData>,
) -> Result<SuccessResponse, String> {
    info!("Received WebSocket initialization request");

    let client_container = get_websocket_client_container();
    let rc = state.rc.lock().await;

    let config = WebSocketConfig {
        server_url: state.config.lock().await.backend.ws_url.clone(),
        client_id: params.client_id,
        token: rc.token.clone(),
        ..Default::default()
    };

    // 클라이언트 인스턴스 가져오기 또는 생성
    let client = {
        let mut client_guard = client_container.write().await;

        // 클라이언트 인스턴스가 이미 있는지 확인
        if let Some(existing_client) = client_guard.as_ref() {
            // 클라이언트가 이미 있고 연결된 경우 성공 반환
            if existing_client.is_connected() {
                info!("WebSocket already connected, skipping duplicate connection");
                return Ok(SuccessResponse::new());
            }

            // 클라이언트가 이미 있지만 연결되지 않은 경우 기존 클라이언트 사용
            info!("Reconnecting using existing WebSocket client instance");
            existing_client.clone()
        } else {
            // 클라이언트가 없으면 새 인스턴스 생성
            info!("Creating new WebSocket client instance");
            let new_client = WebSocketClient::new(app_handle);
            *client_guard = Some(new_client.clone());
            new_client
        }
    };

    tokio::spawn(async move {
        match client.connect(config).await {
            Ok(_) => {
                info!("WebSocket connection initialized successfully");
            }
            Err(e) => {
                error!(" WebSocket connection initialization failed: {}", e);
            }
        }
    });

    Ok(SuccessResponse::new())
}

/// WebSocket 연결 끊기
#[tauri::command]
pub async fn ws_disconnect(_app_handle: AppHandle) -> Result<SuccessResponse, String> {
    info!("Received WebSocket disconnect request");

    let client_container = get_websocket_client_container();
    let mut client_guard = client_container.write().await;

    if let Some(client) = client_guard.take() {
        client.internal_disconnect().await;
    }

    info!("WebSocket connection disconnected");
    Ok(SuccessResponse::new())
}

/// WebSocket 메시지 전송
#[tauri::command]
pub async fn ws_send_message(
    _app_handle: AppHandle,
    params: SendMessageParams,
) -> Result<SuccessResponse, String> {
    let client_container = get_websocket_client_container();
    let client_guard = client_container.read().await;

    if let Some(client) = client_guard.as_ref() {
        match client.send_message(params.data).await {
            Ok(_) => Ok(SuccessResponse::new()),
            Err(e) => {
                error!(" Failed to send message: {}", e);
                Err(format!("전송 실패: {}", e))
            }
        }
    } else {
        error!(" WebSocket not initialized");
        Err("WebSocket 초기화되지 않음".to_string())
    }
}

/// 연결 상태 가져오기
#[tauri::command]
pub async fn ws_get_state(_app_handle: AppHandle) -> Result<ConnectionState, String> {
    let client_container = get_websocket_client_container();
    let client_guard = client_container.read().await;

    if let Some(client) = client_guard.as_ref() {
        Ok(client.get_state().await)
    } else {
        Ok(ConnectionState::Disconnected)
    }
}

/// 연결 상태 확인
#[tauri::command]
pub async fn ws_get_health(_app_handle: AppHandle) -> Result<ConnectionHealth, String> {
    let client_container = get_websocket_client_container();
    let client_guard = client_container.read().await;

    if let Some(client) = client_guard.as_ref() {
        Ok(client.get_health_status().await)
    } else {
        Err("WebSocket 초기화되지 않음".to_string())
    }
}

/// 강제 재연결
#[tauri::command]
pub async fn ws_force_reconnect(_app_handle: AppHandle) -> Result<SuccessResponse, String> {
    info!("Received force reconnect request");

    let client_container = get_websocket_client_container();
    let client_guard = client_container.read().await;

    if let Some(client) = client_guard.as_ref() {
        match client.force_reconnect().await {
            Ok(_) => {
                info!("WebSocket reconnected successfully");
                Ok(SuccessResponse::new())
            }
            Err(e) => {
                error!(" WebSocket reconnection failed: {}", e);
                Err(format!("재연결 실패: {}", e))
            }
        }
    } else {
        error!(" WebSocket not initialized, cannot reconnect");
        Err("WebSocket 초기화되지 않음".to_string())
    }
}

/// WebSocket 구성 업데이트
#[tauri::command]
pub async fn ws_update_config(
    _app_handle: AppHandle,
    params: UpdateConfigParams,
) -> Result<SuccessResponse, String> {
    info!("Updating WebSocket configuration");

    let client_container = get_websocket_client_container();
    let client_guard = client_container.read().await;

    if let Some(client) = client_guard.as_ref() {
        // 현재 구성 가져오기 (여기서는 현재 구성을 가져오는 메서드를 추가해야 함)
        let mut config = WebSocketConfig::default();

        // 구성 업데이트
        if let Some(interval) = params.heartbeat_interval {
            config.heartbeat_interval = interval;
        }
        if let Some(timeout) = params.heartbeat_timeout {
            config.heartbeat_timeout = timeout;
        }
        if let Some(attempts) = params.max_reconnect_attempts {
            config.max_reconnect_attempts = attempts;
        }
        if let Some(delay) = params.reconnect_delay_ms {
            config.reconnect_delay_ms = delay;
        }

        client.update_config(config).await;
        info!("WebSocket configuration updated successfully");
        Ok(SuccessResponse::new())
    } else {
        error!(" WebSocket not initialized, cannot update configuration");
        Err("WebSocket 초기화되지 않음".to_string())
    }
}

/// 연결 상태 확인
#[tauri::command]
pub async fn ws_is_connected(_app_handle: AppHandle) -> Result<bool, String> {
    let client_container = get_websocket_client_container();
    let client_guard = client_container.read().await;

    if let Some(client) = client_guard.as_ref() {
        Ok(client.is_connected())
    } else {
        Ok(false)
    }
}

/// 앱 백그라운드 상태 설정
#[tauri::command]
pub async fn ws_set_app_background_state(
    _app_handle: AppHandle,
    is_background: bool,
) -> Result<SuccessResponse, String> {
    info!(
        "앱 상태 변경 요청 수신: {}",
        if is_background { "백그라운드" } else { "포그라운드" }
    );

    let client_container = get_websocket_client_container();
    let client_guard = client_container.read().await;

    if let Some(client) = client_guard.as_ref() {
        client.set_app_background_state(is_background);
    }

    Ok(SuccessResponse::new())
}

/// 앱 백그라운드 상태 가져오기
#[tauri::command]
pub async fn ws_get_app_background_state(_app_handle: AppHandle) -> Result<bool, String> {
    let client_container = get_websocket_client_container();
    let client_guard = client_container.read().await;

    if let Some(client) = client_guard.as_ref() {
        Ok(client.is_app_in_background())
    } else {
        Ok(false)
    }
}
