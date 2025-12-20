use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// WebSocket 연결 상태
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ConnectionState {
    /// 초기 상태
    Disconnected,
    /// 연결 시도 중
    Connecting,
    /// 연결됨
    Connected,
    /// 재연결 중
    Reconnecting,
    /// 연결 에러
    Error,
}

/// WebSocket 메시지 타입 (송신용)
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum WsMessage {
    /// 하트비트
    #[serde(rename = "13")]
    Heartbeat,
    /// 하트비트 응답
    #[serde(rename = "14")]
    HeartbeatResponse { timestamp: u64 },
    /// 일반 메시지
    #[serde(rename = "message")]
    ChatMessage(serde_json::Value),
    /// 기타 비즈니스 메시지
    #[serde(untagged)]
    Business(serde_json::Value),
}

/// WebSocket 응답 메시지 타입 (수신용)
#[derive(Debug, Serialize, Deserialize)]
pub struct WsResponseMessage {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub data: Option<serde_json::Value>,
}

/// WebSocket 설정
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketConfig {
    pub server_url: String,
    pub client_id: String,
    pub token: String,
    pub heartbeat_interval: u64,
    pub heartbeat_timeout: u64,
    pub max_reconnect_attempts: u32,
    pub reconnect_delay_ms: u64,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            server_url: String::new(),
            client_id: String::new(),
            token: String::new(),
            heartbeat_interval: 30000, // 30초
            heartbeat_timeout: 10000,  // 10초
            max_reconnect_attempts: 10,
            reconnect_delay_ms: 1000, // 1초
        }
    }
}

/// 연결 헬스 상태
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionHealth {
    pub is_healthy: bool,
    pub last_pong_time: Option<u64>,
    pub consecutive_failures: u32,
    pub round_trip_time: Option<u64>,
}

/// 프론트엔드로 전송되는 WebSocket 이벤트
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "event", content = "payload")]
pub enum WebSocketEvent {
    /// 연결 상태 변경
    ConnectionStateChanged {
        state: ConnectionState,
        is_reconnection: bool,
    },
    /// 메시지 수신
    MessageReceived { message: serde_json::Value },
    /// 하트비트 상태 변경
    HeartbeatStatusChanged { health: ConnectionHealth },
    /// 에러 발생
    Error {
        message: String,
        details: Option<HashMap<String, serde_json::Value>>,
    },
}

/// 비즈니스 요청 구조
#[derive(Debug, Serialize)]
pub struct WsRequest {
    #[serde(rename = "type")]
    pub msg_type: String,
    pub data: serde_json::Value,
}

/// 재연결 설정
#[derive(Debug, Clone)]
pub struct ReconnectConfig {
    pub initial_delay: Duration,
    pub max_delay: Duration,
    pub max_attempts: u32,
}

impl Default for ReconnectConfig {
    fn default() -> Self {
        Self {
            initial_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(60),
            max_attempts: 10,
        }
    }
}
