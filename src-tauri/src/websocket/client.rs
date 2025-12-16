use crate::AppData;
use crate::command::message_command::{SyncMessagesParam, sync_messages};
use crate::websocket::commands::get_websocket_client_container;

use super::types::*;
use anyhow::Result;
use chrono::Utc;
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{Mutex, RwLock, mpsc};
use tokio::task::JoinHandle;
use tokio::time::{Duration, interval, sleep};

use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{debug, error, info, warn};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AckMessage {
    pub msg_id: String,
    pub timestamp: i64,
}

impl AckMessage {
    pub fn new(msg_id: String) -> Self {
        Self {
            msg_id,
            timestamp: Utc::now().timestamp_millis(),
        }
    }
}

/// WebSocket 클라이언트
#[derive(Clone)]
pub struct WebSocketClient {
    config: Arc<RwLock<WebSocketConfig>>,
    state: Arc<RwLock<ConnectionState>>,
    app_handle: AppHandle,

    // 하트비트 관련
    last_pong_time: Arc<AtomicU64>,
    consecutive_failures: Arc<AtomicU32>,
    heartbeat_active: Arc<AtomicBool>,

    // 재연결 관련
    reconnect_attempts: Arc<AtomicU32>,
    is_reconnecting: Arc<AtomicBool>,

    // 메시지 큐
    message_sender: Arc<RwLock<Option<mpsc::UnboundedSender<Message>>>>,
    pending_messages: Arc<RwLock<Vec<serde_json::Value>>>,

    // 연결 제어
    should_stop: Arc<AtomicBool>,

    // 앱 상태 추적
    is_app_in_background: Arc<AtomicBool>,
    last_foreground_time: Arc<AtomicU64>,
    background_heartbeat_failures: Arc<AtomicU32>,

    // 연결 상태 표시
    is_ws_connected: Arc<AtomicBool>,

    // 동시 연결 방지를 위한 연결 뮤텍스
    connection_mutex: Arc<Mutex<()>>,

    // 작업 핸들 관리
    task_handles: Arc<RwLock<Vec<JoinHandle<()>>>>,

    // 종료 신호 전송기
    close_sender: Arc<RwLock<Option<mpsc::UnboundedSender<()>>>>,
}

impl WebSocketClient {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            config: Arc::new(RwLock::new(WebSocketConfig::default())),
            state: Arc::new(RwLock::new(ConnectionState::Disconnected)),
            app_handle,
            last_pong_time: Arc::new(AtomicU64::new(0)),
            consecutive_failures: Arc::new(AtomicU32::new(0)),
            heartbeat_active: Arc::new(AtomicBool::new(false)),
            reconnect_attempts: Arc::new(AtomicU32::new(0)),
            is_reconnecting: Arc::new(AtomicBool::new(false)),
            message_sender: Arc::new(RwLock::new(None)),
            pending_messages: Arc::new(RwLock::new(Vec::new())),
            should_stop: Arc::new(AtomicBool::new(false)),
            is_app_in_background: Arc::new(AtomicBool::new(false)),
            last_foreground_time: Arc::new(AtomicU64::new(
                chrono::Utc::now().timestamp_millis() as u64
            )),
            background_heartbeat_failures: Arc::new(AtomicU32::new(0)),
            is_ws_connected: Arc::new(AtomicBool::new(false)),
            connection_mutex: Arc::new(Mutex::new(())),
            task_handles: Arc::new(RwLock::new(Vec::new())),
            close_sender: Arc::new(RwLock::new(None)),
        }
    }

    /// 연결 초기화
    pub async fn connect(&self, config: WebSocketConfig) -> Result<()> {
        // 연결 잠금 획득, 동시에 하나의 연결 작업만 수행되도록 보장
        let _lock: tokio::sync::MutexGuard<'_, ()> = self.connection_mutex.lock().await;
        info!(
            "Initializing WebSocket connection to: {}",
            config.server_url
        );

        // 잠금 보호 하에 연결 상태 다시 확인
        if self.is_ws_connected.load(Ordering::SeqCst) {
            warn!("WebSocket already connected, ignoring duplicate connection request");
            return Ok(());
        }

        // 구성 업데이트
        *self.config.write().await = config;
        self.should_stop.store(false, Ordering::SeqCst);

        // 연결 루프 시작
        self.connection_loop().await?;

        Ok(())
    }

    /// 연결 끊기
    pub async fn disconnect(&self) {
        let _lock = self.connection_mutex.lock().await;
        self.internal_disconnect().await;
    }

    /// 내부 연결 끊기 메서드 (잠금 획득 안 함)
    pub async fn internal_disconnect(&self) {
        info!("Disconnecting WebSocket connection");
        self.should_stop.store(true, Ordering::SeqCst);

        // 연결 상태 업데이트
        self.is_ws_connected.store(false, Ordering::SeqCst);

        // 모든 작업 취소
        let mut handles = self.task_handles.write().await;
        let task_count = handles.len();
        for handle in handles.drain(..) {
            handle.abort();
        }
        info!("Cancelled {} async tasks", task_count);

        // WebSocket 연결을 능동적으로 닫기 위해 종료 신호 전송
        if let Some(close_sender) = self.close_sender.write().await.take() {
            if let Err(_) = close_sender.send(()) {
                warn!("Failed to send close signal, connection may already be closed");
            } else {
                info!("WebSocket close signal sent");
            }
        }

        // 메시지 전송기 정리
        *self.message_sender.write().await = None;

        // 상태 업데이트
        self.update_state(ConnectionState::Disconnected, false)
            .await;

        // 카운터 재설정
        self.consecutive_failures.store(0, Ordering::SeqCst);
        self.reconnect_attempts.store(0, Ordering::SeqCst);
        self.heartbeat_active.store(false, Ordering::SeqCst);

        info!("WebSocket connection completely disconnected");
    }

    /// 메시지 전송
    pub async fn send_message(&self, data: serde_json::Value) -> Result<()> {
        // 먼저 연결 상태 확인
        let current_state = self.get_state().await;

        match current_state {
            ConnectionState::Connected => {
                let sender = self.message_sender.read().await;

                if let Some(sender) = sender.as_ref() {
                    let message = Message::Text(data.to_string().into());
                    sender.send(message.clone()).map_err(|e| {
                        anyhow::anyhow!("Failed to queue message for sending: {}", e)
                    })?;
                    info!("Message sent {:?}", message);
                    Ok(())
                } else {
                    warn!("Connection state is Connected but sender not ready, message queued");
                    // 연결이 완전히 설정되지 않음, 메시지를 대기열에 추가
                    let mut pending = self.pending_messages.write().await;
                    pending.push(data);

                    // 대기열 길이 제한
                    if pending.len() > 100 {
                        pending.remove(0);
                        warn!("Pending queue full, dropping oldest message");
                    }

                    // 오류 반환, 상위 계층에 메시지가 즉시 전송되지 않았음을 알림
                    Err(anyhow::anyhow!(
                        "Connection not fully established, message queued"
                    ))
                }
            }
            ConnectionState::Connecting | ConnectionState::Reconnecting => {
                // 연결 중, 메시지를 대기열에 추가
                let mut pending = self.pending_messages.write().await;
                pending.push(data);
                warn!(
                    "연결 중, 메시지가 대기열에 추가되었습니다 (대기열 길이: {})",
                    pending.len()
                );

                // 대기열 길이 제한
                if pending.len() > 100 {
                    pending.remove(0);
                    warn!("Pending queue full, dropping oldest message");
                }

                Err(anyhow::anyhow!("WebSocket is connecting, message queued"))
            }
            _ => {
                warn!("WebSocket 연결되지 않음 (상태: {:?}), 메시지 전송 불가", current_state);
                Err(anyhow::anyhow!(
                    "WebSocket not connected (state: {:?})",
                    current_state
                ))
            }
        }
    }

    /// 연결 상태 확인
    pub async fn get_health_status(&self) -> ConnectionHealth {
        let last_pong = self.last_pong_time.load(Ordering::SeqCst);
        let failures = self.consecutive_failures.load(Ordering::SeqCst);
        let now = chrono::Utc::now().timestamp_millis() as u64;

        let is_healthy = if last_pong == 0 {
            // 퐁을 아직 받지 못한 경우 연결 상태에 따라 판단
            matches!(*self.state.read().await, ConnectionState::Connected)
        } else {
            now - last_pong < 30000 // 30초 이내에 퐁을 받으면 정상으로 간주
        };

        ConnectionHealth {
            is_healthy,
            last_pong_time: if last_pong == 0 {
                None
            } else {
                Some(last_pong)
            },
            consecutive_failures: failures,
            round_trip_time: None, // 하트비트 시 계산 가능
        }
    }

    /// 강제 재연결
    pub async fn force_reconnect(&self) -> Result<()> {
        info!("Force reconnecting");

        // 연결 잠금 획득
        let _lock = self.connection_mutex.lock().await;

        // 프론트엔드에 동기화 힌트를 표시하기 위해 재연결로 표시
        self.is_reconnecting.store(true, Ordering::SeqCst);

        self.reconnect_attempts.store(0, Ordering::SeqCst);

        // 먼저 현재 연결 끊기
        self.internal_disconnect().await;

        // 다시 연결
        let config = self.config.read().await.clone();

        // 구성 업데이트
        *self.config.write().await = config.clone();
        self.should_stop.store(false, Ordering::SeqCst);

        // 연결 루프 시작
        self.connection_loop().await
    }

    /// 메인 연결 루프
    async fn connection_loop(&self) -> Result<()> {
        loop {
            // 중지해야 하는지 확인
            if self.should_stop.load(Ordering::SeqCst) {
                info!("Received stop signal, exiting connection loop");
                break;
            }

            match self.try_connect().await {
                Ok(_) => {
                    info!("WebSocket connection established");
                    self.reconnect_attempts.store(0, Ordering::SeqCst);

                    // 연결이 끊어질 때까지 연결 상태 모니터링
                    while self.is_ws_connected.load(Ordering::SeqCst)
                        && !self.should_stop.load(Ordering::SeqCst)
                    {
                        sleep(Duration::from_millis(100)).await;
                    }

                    info!("Connection disconnected, preparing to reconnect...");
                    self.is_reconnecting.store(true, Ordering::SeqCst);
                    self.update_state(ConnectionState::Reconnecting, true).await;
                    // 현재 연결 상태 정리
                    self.cleanup_connection_state().await;

                    continue;
                }
                Err(e) => {
                    // max_reconnect_attempts가 0이면 무한 재연결을 의미하므로 오버플로 방지를 위해 포화 덧셈 사용
                    let attempts = self
                        .reconnect_attempts
                        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |val| {
                            Some(val.saturating_add(1))
                        })
                        .map(|old| old.saturating_add(1))
                        .unwrap_or_else(|old| old.saturating_add(1));
                    let config = self.config.read().await;

                    error!(
                        " WebSocket connection failed (attempt {}/{}) : {}",
                        attempts,
                        if config.max_reconnect_attempts == 0 {
                            "∞".to_string()
                        } else {
                            config.max_reconnect_attempts.to_string()
                        },
                        e
                    );

                    // max_reconnect_attempts가 0이면 횟수 상한 제한 없음; 그렇지 않으면 상한 따름
                    if config.max_reconnect_attempts > 0
                        && attempts >= config.max_reconnect_attempts
                    {
                        self.emit_error(
                            "Too many connection failures, stopping retry".to_string(),
                            None,
                        )
                        .await;
                        self.is_ws_connected.store(false, Ordering::SeqCst);
                        self.update_state(ConnectionState::Error, false).await;
                        return Err(anyhow::anyhow!("Max reconnection attempts reached"));
                    }

                    // 지수 백오프 지연
                    // attempts가 무한히 증가하여 거듭제곱 계산 오버플로가 발생하는 것을 방지하기 위해 백오프 단계 상한 설정
                    let backoff_steps = attempts.saturating_sub(1).min(10);
                    let delay = std::cmp::min(
                        config.reconnect_delay_ms * (2_u64.pow(backoff_steps)),
                        15000, // 최대 15초
                    );

                    info!("Retrying connection in {}ms...", delay);
                    self.update_state(ConnectionState::Reconnecting, true).await;
                    sleep(Duration::from_millis(delay)).await;
                }
            }
        }
        Ok(())
    }

    /// 연결 상태 정리
    async fn cleanup_connection_state(&self) {
        // 하트비트 중지
        self.heartbeat_active.store(false, Ordering::SeqCst);

        // 메시지 전송기 정리
        *self.message_sender.write().await = None;

        // 종료 신호 전송기 정리
        *self.close_sender.write().await = None;

        // 연결 상태 재설정
        self.is_ws_connected.store(false, Ordering::SeqCst);

        info!("Connection state cleaned up");
    }

    /// 연결 시도
    async fn try_connect(&self) -> Result<()> {
        let config = self.config.read().await.clone();

        // 연결 URL 구축
        let mut url = Url::parse(&config.server_url)
            .map_err(|e| anyhow::anyhow!("Invalid WebSocket URL '{}': {}", config.server_url, e))?;

        url.query_pairs_mut()
            .append_pair("clientId", &config.client_id);

        if let Some(ref token) = config.token {
            url.query_pairs_mut().append_pair("Token", token);
        }

        let url_str = url.as_str();
        info!("Connecting to WebSocket: {}", url_str);
        self.update_state(ConnectionState::Connecting, false).await;

        // 연결 수립
        let (ws_stream, _) = connect_async(url_str)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to connect to WebSocket '{}': {}", url_str, e))?;

        let (mut ws_sender, mut ws_receiver) = ws_stream.split();

        // 메시지 채널 생성
        let (msg_sender, mut msg_receiver) = mpsc::unbounded_channel();
        *self.message_sender.write().await = Some(msg_sender);

        // 종료 신호 채널 생성
        let (close_sender, mut close_receiver) = mpsc::unbounded_channel();
        *self.close_sender.write().await = Some(close_sender);

        // 연결 상태 업데이트
        let was_reconnecting = self.is_reconnecting.swap(false, Ordering::SeqCst);
        self.update_state(ConnectionState::Connected, was_reconnecting)
            .await;

        if was_reconnecting {
            self.schedule_post_reconnect_sync();
        }

        // 연결됨으로 표시
        self.is_ws_connected.store(true, Ordering::SeqCst);

        // 대기 중인 메시지 전송
        self.send_pending_messages().await?;

        // 하트비트 시작
        self.start_heartbeat().await;

        // 메시지 전송 처리
        let message_sender_task = {
            let should_stop = self.should_stop.clone();
            let is_ws_connected = self.is_ws_connected.clone();
            tokio::spawn(async move {
                while !should_stop.load(Ordering::SeqCst) {
                    tokio::select! {
                        Some(message) = msg_receiver.recv() => {
                            if let Err(e) = ws_sender.send(message).await {
                                error!(" Failed to send message: {}", e);
                                is_ws_connected.store(false, Ordering::SeqCst);
                                break;
                            }
                        }
                        Some(_) = close_receiver.recv() => {
                            info!("Received close signal, actively closing WebSocket connection");
                            if let Err(e) = ws_sender.close().await {
                                warn!("Error closing WebSocket connection: {}", e);
                            } else {
                                info!("WebSocket connection actively closed");
                            }
                            break;
                        }
                        else => break,
                    }
                }
            })
        };

        // 메시지 수신 처리
        let message_receiver_task = {
            let app_handle = self.app_handle.clone();
            let last_pong_time = self.last_pong_time.clone();
            let consecutive_failures = self.consecutive_failures.clone();
            let is_ws_connected = self.is_ws_connected.clone();

            tokio::spawn(async move {
                while let Some(msg) = ws_receiver.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            Self::handle_message_static(
                                text.to_string(),
                                &app_handle,
                                &last_pong_time,
                                &consecutive_failures,
                            )
                            .await;
                        }
                        Ok(Message::Binary(data)) => {
                            if let Ok(text) = String::from_utf8(data.to_vec()) {
                                Self::handle_message_static(
                                    text,
                                    &app_handle,
                                    &last_pong_time,
                                    &consecutive_failures,
                                )
                                .await;
                            }
                        }
                        Ok(Message::Close(_)) => {
                            info!("WebSocket connection closed");
                            is_ws_connected.store(false, Ordering::SeqCst);
                            break;
                        }
                        Err(e) => {
                            error!(" WebSocket message receive error: {}", e);
                            is_ws_connected.store(false, Ordering::SeqCst);
                            break;
                        }
                        _ => {}
                    }
                }
            })
        };

        // 백그라운드 작업 모니터링 시작
        let should_stop = self.should_stop.clone();
        let heartbeat_active = self.heartbeat_active.clone();
        let message_sender_ref = self.message_sender.clone();

        let monitor_task = tokio::spawn(async move {
            // 작업 완료 또는 중지 신호 대기
            tokio::select! {
                _ = message_sender_task => {
                    info!("Message sending task ended");
                }
                _ = message_receiver_task => {
                    info!("Message receiving task ended");
                }
                _ = async {
                    while !should_stop.load(Ordering::SeqCst) {
                        sleep(Duration::from_millis(100)).await;
                    }
                } => {
                    info!("Received stop signal");
                }
            }

            // 정리
            heartbeat_active.store(false, Ordering::SeqCst);
            *message_sender_ref.write().await = None;
        });

        // 모니터링 작업 핸들 저장
        let mut handles = self.task_handles.write().await;
        handles.push(monitor_task);

        info!("WebSocket connection and background tasks started");
        Ok(())
    }

    /// 수신된 메시지 처리 (비동기 작업을 위한 정적 메서드)
    async fn handle_message_static(
        text: String,
        app_handle: &AppHandle,
        last_pong_time: &Arc<AtomicU64>,
        consecutive_failures: &Arc<AtomicU32>,
    ) {
        info!("Received message: {}", text);

        // 하트비트 응답 파싱 시도
        if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
            match ws_msg {
                WsMessage::HeartbeatResponse { timestamp: _ } => {
                    let now = chrono::Utc::now().timestamp_millis() as u64;
                    last_pong_time.store(now, Ordering::SeqCst);
                    consecutive_failures.store(0, Ordering::SeqCst);

                    info!("Received heartbeat response");

                    let health = ConnectionHealth {
                        is_healthy: true,
                        last_pong_time: Some(now),
                        consecutive_failures: 0,
                        round_trip_time: None,
                    };

                    let _ = app_handle.emit(
                        "websocket-event",
                        &WebSocketEvent::HeartbeatStatusChanged { health },
                    );
                    return;
                }
                _ => {}
            }
        }

        // 비즈니스 메시지 처리
        if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(&text) {
            // 구체적인 비즈니스 메시지 유형 처리
            Self::process_business_message(&json_value, app_handle).await;

            // 원본 메시지 이벤트도 함께 전송 (호환성 유지)
            let _ = app_handle.emit(
                "websocket-event",
                &WebSocketEvent::MessageReceived {
                    message: json_value,
                },
            );
        } else {
            // JSON이 아닌 메시지, 직접 전달
            let _ = app_handle.emit(
                "websocket-event",
                &WebSocketEvent::MessageReceived {
                    message: serde_json::Value::String(text),
                },
            );
        }
    }

    pub async fn send_ack(&self, message_id: &str) -> Result<()> {
        let ack_message = AckMessage::new(message_id.to_string());

        let ack_json = serde_json::json!({
            "type": "15",
            "data": ack_message
        });

        // 재시도 메커니즘 추가
        let max_retries = 3;
        let mut retry_count = 0;

        while retry_count < max_retries {
            match self.send_message(ack_json.clone()).await {
                Ok(_) => {
                    info!(
                        "Sent ACK for message {} (attempt: {})",
                        message_id,
                        retry_count + 1
                    );
                    return Ok(());
                }
                Err(e) => {
                    retry_count += 1;
                    if retry_count >= max_retries {
                        error!(
                            " Failed to send ACK for message {} after {} attempts: {}",
                            message_id, max_retries, e
                        );
                        return Err(e);
                    }

                    warn!(
                        "Failed to send ACK for message {} (attempt {}), retrying...: {}",
                        message_id, retry_count, e
                    );

                    // 지수 백오프
                    tokio::time::sleep(Duration::from_millis(100 * 2u64.pow(retry_count as u32)))
                        .await;
                }
            }
        }

        Err(anyhow::anyhow!("Failed to send ACK after all retries"))
    }

    /// 비즈니스 메시지 유형 처리
    async fn process_business_message(message: &serde_json::Value, app_handle: &AppHandle) {
        // 메시지 유형 추출
        let message_type = message.get("type").and_then(|t| t.as_str()).unwrap_or("");

        // 메시지 데이터 추출
        let data = message.get("data");

        debug!("Processing business message type: {}", message_type);

        // 메시지 유형에 따라 처리하고 해당 이벤트 전송
        match message_type {
            // 로그인 관련
            "loginQrCode" => {
                info!("Getting login QR code");
                let _ = app_handle.emit("ws-login-qr-code", data);
            }
            "waitingAuthorize" => {
                info!("Waiting for authorization");
                let _ = app_handle.emit("ws-waiting-authorize", data);
            }
            "loginSuccess" => {
                info!("Login successful");
                let _ = app_handle.emit_to("home", "ws-login-success", data);
            }

            // 메시지 관련 TODO 현재 채팅 메시지의 ack만 구현됨
            "receiveMessage" => {
                info!("Received message");

                let client_container = get_websocket_client_container();
                let client_guard = client_container.read().await;

                if let Some(data_obj) = data {
                    if let Some(message_id) = data_obj
                        .get("message")
                        .and_then(|m| m.get("id"))
                        .and_then(|id| id.as_str())
                    {
                        info!("수신 확인 ACK: {}", message_id);

                        if let Some(client) = client_guard.as_ref() {
                            match client.send_ack(message_id).await {
                                Ok(_) => {
                                    info!("ACK sent successfully for message {}", message_id);
                                }
                                Err(e) => {
                                    error!(" Failed to send ACK for message {}: {}", message_id, e);
                                }
                            };
                        } else {
                            error!(" 수신 확인 실패");
                        }
                    }
                }

                let _ = app_handle.emit_to("home", "ws-receive-message", data);
            }
            "msgRecall" => {
                info!("Message recalled");
                let _ = app_handle.emit_to("home", "ws-msg-recall", data);
            }
            "msgMarkItem" => {
                info!("Message liked/disliked");
                let _ = app_handle.emit_to("home", "ws-msg-mark-item", data);
            }

            // 사용자 상태 관련
            "online" => {
                info!("User online");
                let _ = app_handle.emit_to("home", "ws-online", data);
            }
            "offline" => {
                info!("User offline");
                let _ = app_handle.emit_to("home", "ws-offline", data);
            }
            "userStateChange" => {
                info!("User state changed");
                let _ = app_handle.emit_to("home", "ws-user-state-change", data);
            }
            // 알림 버스
            "notifyEvent" => {
                info!("新的notifyEvent");
                let _ = app_handle.emit_to("home", "ws-request-notify-event", data);
            }
            "groupSetAdmin" => {
                let _ = app_handle.emit_to("home", "ws-group-set-admin-success", data);
            }
            // 친구 관련
            "newApply" => {
                info!("New apply request");
                let _ = app_handle.emit_to("home", "ws-request-new-apply", data);
            }
            "requestApprovalFriend" => {
                info!("Friend request approved");
                let _ = app_handle.emit_to("home", "ws-request-approval-friend", data);
            }
            "memberChange" => {
                info!("Member change");
                let _ = app_handle.emit_to("home", "ws-member-change", data);
            }

            // 방/그룹 채팅 관련
            "roomInfoChange" => {
                info!("Room info changed");
                let _ = app_handle.emit_to("home", "ws-room-info-change", data);
            }
            "myRoomInfoChange" => {
                info!("My room info changed");
                let _ = app_handle.emit_to("home", "ws-my-room-info-change", data);
            }
            "roomGroupNoticeMsg" => {
                info!("Group notice published");
                let _ = app_handle.emit_to("home", "ws-room-group-notice-msg", data);
            }
            "roomEditGroupNoticeMsg" => {
                info!("✏️ Group notice edited");
                let _ = app_handle.emit_to("home", "ws-room-edit-group-notice-msg", data);
            }
            "roomDissolution" => {
                info!("Room dissolved");
                let _ = app_handle.emit_to("home", "ws-room-dissolution", data);
            }

            // 화상 통화 관련
            "VideoCallRequest" => {
                info!("Received call request");
                let _ = app_handle.emit("ws-video-call-request", data);
            }
            "CallAccepted" => {
                info!("Call accepted");
                let _ = app_handle.emit("ws-call-accepted", data);
            }
            "CallRejected" => {
                info!(" Call rejected");
                let _ = app_handle.emit("ws-call-rejected", data);
            }
            "RoomClosed" => {
                info!("Room closed");
                let _ = app_handle.emit("ws-room-closed", data);
            }
            "WEBRTC_SIGNAL" => {
                info!("Signaling message");
                let _ = app_handle.emit("ws-webrtc-signal", data);
            }
            "JoinVideo" => {
                info!("User joined video");
                let _ = app_handle.emit("ws-join-video", data);
            }
            "LeaveVideo" => {
                info!("User left video");
                let _ = app_handle.emit("ws-leave-video", data);
            }
            "DROPPED" => {
                info!("Call dropped");
                let _ = app_handle.emit("ws-dropped", data);
            }

            "CANCEL" => {
                info!("Call cancelled");
                let _ = app_handle.emit("ws-cancel", data);
            }

            "TIMEOUT" => {
                info!("Call timeout");
                let _ = app_handle.emit("ws-timeout", data);
            }

            // 시스템 관련
            "tokenExpired" => {
                warn!("Token expired");
                let _ = app_handle.emit("ws-token-expired", data);
            }
            "invalidUser" => {
                warn!("Invalid user");
                let _ = app_handle.emit("ws-invalid-user", data);
            }

            "deleteFriend" => {
                warn!("Delete Friend");
                let _ = app_handle.emit("ws-delete-friend", data);
            }

            // 모멘트 관련
            "feedSendMsg" => {
                info!("Feed message received");
                let _ = app_handle.emit_to("home", "ws-feed-send-msg", data);
            }
            "feedNotify" => {
                info!("Feed notification received (like/comment)");
                let _ = app_handle.emit_to("home", "ws-feed-notify", data);
            }

            // 알 수 없는 메시지 유형
            _ => {
                warn!("Received unhandled message type: {}", message_type);
                // 일반적인 알 수 없는 메시지 이벤트 전송
                let _ = app_handle.emit("ws-unknown-message", message);
            }
        }
    }

    /// 하트비트 메커니즘 시작
    async fn start_heartbeat(&self) {
        if self.heartbeat_active.swap(true, Ordering::SeqCst) {
            return; // 이미 실행 중
        }

        let config = self.config.read().await.clone();
        let interval_ms = config.heartbeat_interval;
        let timeout_ms = config.heartbeat_timeout;

        let heartbeat_task = {
            let heartbeat_active = self.heartbeat_active.clone();
            let should_stop = self.should_stop.clone();
            let last_pong_time = self.last_pong_time.clone();
            let consecutive_failures = self.consecutive_failures.clone();
            let message_sender = self.message_sender.clone();
            let is_app_in_background = self.is_app_in_background.clone();
            let background_heartbeat_failures = self.background_heartbeat_failures.clone();
            let is_ws_connected = self.is_ws_connected.clone();

            tokio::spawn(async move {
                let mut heartbeat_interval = interval(Duration::from_millis(interval_ms));

                while heartbeat_active.load(Ordering::SeqCst) && !should_stop.load(Ordering::SeqCst)
                {
                    heartbeat_interval.tick().await;

                    // 하트비트 전송
                    let heartbeat_msg = WsMessage::Heartbeat;
                    if let Ok(json) = serde_json::to_value(&heartbeat_msg) {
                        let sender = message_sender.read().await;
                        if let Some(sender) = sender.as_ref() {
                            let message = Message::Text(json.to_string().into());
                            if let Err(e) = sender.send(message) {
                                error!(" Failed to send heartbeat: {}", e);
                                break;
                            }
                        } else {
                            warn!("Heartbeat send failed: connection not established");
                            break;
                        }
                    }

                    // 하트비트 타임아웃 확인
                    let last_pong = last_pong_time.load(Ordering::SeqCst);
                    if last_pong > 0 {
                        let now = chrono::Utc::now().timestamp_millis() as u64;
                        let time_since_pong = now - last_pong;

                        // 앱 상태에 따른 타임아웃 정책 조정
                        let is_background = is_app_in_background.load(Ordering::SeqCst);
                        let effective_timeout = if is_background {
                            // 백그라운드 모드에서 더 완화된 타임아웃 시간 (2분)
                            120000
                        } else {
                            timeout_ms
                        };

                        if time_since_pong > effective_timeout {
                            let failures = if is_background {
                                background_heartbeat_failures.fetch_add(1, Ordering::SeqCst) + 1
                            } else {
                                consecutive_failures.fetch_add(1, Ordering::SeqCst) + 1
                            };

                            warn!(
                                "Heartbeat timeout ({} mode, consecutive failures: {}, last heartbeat {}ms ago)",
                                if is_background {
                                    "background"
                                } else {
                                    "foreground"
                                },
                                failures,
                                time_since_pong
                            );

                            // 백그라운드 모드에서 더 완화된 재연결 정책
                            let max_failures = if is_background { 5 } else { 3 };
                            if failures >= max_failures {
                                error!("Consecutive heartbeat timeouts, triggering reconnection");
                                // 하트비트 실패 시 연결 끊김 표시
                                is_ws_connected.store(false, Ordering::SeqCst);
                                break;
                            }
                        }
                    }
                }

                info!("Heartbeat task ended");
            })
        };

        // 하트비트 작업 핸들 저장
        let mut handles = self.task_handles.write().await;
        handles.push(heartbeat_task);
    }

    /// 대기 중인 메시지 전송
    async fn send_pending_messages(&self) -> Result<()> {
        // 먼저 모든 대기 중인 메시지 가져오기
        let messages_to_send = {
            let mut pending = self.pending_messages.write().await;
            if pending.is_empty() {
                return Ok(());
            }

            info!("Preparing to send {} pending messages", pending.len());
            pending.drain(..).collect::<Vec<_>>()
        };

        // 전송기 가져오기
        let sender = self.message_sender.read().await;
        if let Some(sender) = sender.as_ref() {
            let mut failed_messages = Vec::new();

            // 각 메시지 전송 시도
            for message in messages_to_send {
                let text_message = Message::Text(message.to_string().into());
                if let Err(e) = sender.send(text_message) {
                    error!(" Failed to send pending message: {}", e);
                    failed_messages.push(message);
                }
            }

            // 실패한 메시지가 있으면 대기열에 다시 추가
            if !failed_messages.is_empty() {
                let mut pending = self.pending_messages.write().await;
                for msg in failed_messages.into_iter().rev() {
                    pending.insert(0, msg); // 대기열 앞에 삽입
                }
                return Err(anyhow::anyhow!("Some pending messages failed to send"));
            }

            info!("All pending messages sent");
        } else {
            // 전송기가 준비되지 않음, 메시지를 대기열에 다시 추가
            let mut pending = self.pending_messages.write().await;
            for msg in messages_to_send.into_iter().rev() {
                pending.insert(0, msg);
            }
            warn!("Sender not ready, messages re-queued");
            return Err(anyhow::anyhow!("Message sender not ready"));
        }

        Ok(())
    }

    /// 연결 상태 업데이트
    async fn update_state(&self, new_state: ConnectionState, is_reconnection: bool) {
        let mut state = self.state.write().await;
        if *state != new_state {
            *state = new_state.clone();
            drop(state);

            info!("Connection state changed: {:?}", new_state);
            self.emit_event(WebSocketEvent::ConnectionStateChanged {
                state: new_state,
                is_reconnection,
            })
            .await;
        }
    }

    /// 프론트엔드로 이벤트 전송
    async fn emit_event(&self, event: WebSocketEvent) {
        if let Err(e) = self.app_handle.emit("websocket-event", &event) {
            error!(" Failed to emit WebSocket event: {}", e);
        }
    }

    /// 오류 이벤트 전송
    async fn emit_error(
        &self,
        message: String,
        details: Option<std::collections::HashMap<String, serde_json::Value>>,
    ) {
        self.emit_event(WebSocketEvent::Error { message, details })
            .await;
    }

    /// 현재 상태 가져오기
    pub async fn get_state(&self) -> ConnectionState {
        self.state.read().await.clone()
    }

    /// 구성 업데이트
    pub async fn update_config(&self, new_config: WebSocketConfig) {
        *self.config.write().await = new_config;
    }

    /// 앱 백그라운드 상태 설정
    pub fn set_app_background_state(&self, is_background: bool) {
        let was_background = self
            .is_app_in_background
            .swap(is_background, Ordering::SeqCst);

        if is_background && !was_background {
            info!("App entered background mode");
            // 백그라운드 하트비트 실패 횟수 재설정
            self.background_heartbeat_failures
                .store(0, Ordering::SeqCst);
        } else if !is_background && was_background {
            let now = chrono::Utc::now().timestamp_millis() as u64;
            self.last_foreground_time.store(now, Ordering::SeqCst);
            info!("App resumed from background to foreground");

            // 재연결이 필요한지 확인
            tokio::spawn({
                let client = self.clone();
                async move {
                    client.check_and_recover_connection().await;
                }
            });
        }
    }

    /// 연결 확인 및 복구 (백그라운드에서 복귀 시 호출)
    async fn check_and_recover_connection(&self) {
        let current_state = self.get_state().await;
        let last_pong = self.last_pong_time.load(Ordering::SeqCst);
        let now = chrono::Utc::now().timestamp_millis() as u64;

        info!(
            "Checking connection state: {:?}, last heartbeat: {}ms ago",
            current_state,
            if last_pong > 0 { now - last_pong } else { 0 }
        );

        match current_state {
            ConnectionState::Connected => {
                // 하트비트 만료 확인
                if last_pong > 0 && now - last_pong > 60000 {
                    // 60초 동안 하트비트 없음
                    warn!("Connection may be lost, forcing reconnection");
                    if let Err(e) = self.force_reconnect().await {
                        warn!("Auto-reconnection failed: {}", e);
                        // 프론트엔드에 재연결 필요 알림
                        if let Err(emit_err) = self.app_handle.emit(
                            "ws-connection-lost",
                            serde_json::json!({
                                "reason": "auto_reconnect_failed",
                                "error": e.to_string(),
                                "timestamp": chrono::Utc::now().timestamp_millis()
                            }),
                        ) {
                            error!("Failed to emit connection lost event: {}", emit_err);
                        }
                    }
                } else {
                    // 연결 테스트를 위해 하트비트 전송
                    self.send_test_heartbeat().await;
                }
            }
            ConnectionState::Disconnected | ConnectionState::Error => {
                info!("Connection disconnected, attempting to reconnect");
                if let Err(e) = self.force_reconnect().await {
                    warn!("Auto-reconnection failed: {}", e);
                    // 프론트엔드에 재연결 필요 알림
                    if let Err(emit_err) = self.app_handle.emit(
                        "ws-connection-lost",
                        serde_json::json!({
                            "reason": "auto_reconnect_failed",
                            "error": e.to_string(),
                            "timestamp": chrono::Utc::now().timestamp_millis()
                        }),
                    ) {
                        error!("Failed to emit connection lost event: {}", emit_err);
                    }
                }
            }
            _ => {
                info!(
                    "Connection state: {:?}, waiting for connection to complete",
                    current_state
                );
            }
        }
    }

    /// 테스트 하트비트 전송
    async fn send_test_heartbeat(&self) {
        let heartbeat_msg = WsMessage::Heartbeat;
        if let Ok(json) = serde_json::to_value(&heartbeat_msg) {
            match self.send_message(json).await {
                Ok(_) => {
                    info!("Test heartbeat sent successfully");
                }
                Err(e) => {
                    warn!("Test heartbeat failed: {}", e);
                    // 이벤트를 통해 프론트엔드에 재연결 필요 알림
                    if let Err(emit_err) = self.app_handle.emit(
                        "ws-connection-lost",
                        serde_json::json!({
                            "reason": "test_heartbeat_failed",
                            "error": e.to_string(),
                            "timestamp": chrono::Utc::now().timestamp_millis()
                        }),
                    ) {
                        error!("Failed to emit connection lost event: {}", emit_err);
                    }
                }
            }
        }
    }

    /// 앱 백그라운드 상태 가져오기
    pub fn is_app_in_background(&self) -> bool {
        self.is_app_in_background.load(Ordering::SeqCst)
    }

    /// WebSocket 연결 여부 확인
    pub fn is_connected(&self) -> bool {
        self.is_ws_connected.load(Ordering::SeqCst)
    }

    fn schedule_post_reconnect_sync(&self) {
        let app_handle = self.app_handle.clone();
        tokio::spawn(async move {
            if let Err(err) = Self::run_sync_messages(&app_handle).await {
                warn!("Post-reconnect message sync failed: {}", err);
            } else {
                info!("Post-reconnect message sync completed");
            }
        });
    }

    async fn run_sync_messages(app_handle: &AppHandle) -> Result<(), String> {
        let state: State<'_, AppData> = app_handle.state();

        let params = Some(SyncMessagesParam {
            async_data: Some(true),
            full_sync: Some(false),
            uid: None,
        });

        sync_messages(params, state).await
    }
}
