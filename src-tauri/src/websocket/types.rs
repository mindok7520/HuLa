use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// WebSocket 연결 상태
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConnectionState {
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error,
}

/// WebSocket 메시지 유형
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WsMessage {
    /// 하트비트 메시지 (ping)
    #[serde(rename = "2")]
    Heartbeat,
    /// 하트비트 응답 (pong)
    #[serde(rename = "3", rename_all = "camelCase")]
    HeartbeatResponse { timestamp: u64 },
    /// 일반 메시지
    Message {
        #[serde(flatten)]
        data: serde_json::Value,
    },
}

/// WebSocket 응답 메시지 유형
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsResponseMessage {
    #[serde(rename = "type")]
    pub msg_type: u32,
    pub data: Option<serde_json::Value>,
}

/// WebSocket 연결 구성
#[derive(Debug, Clone)]
pub struct WebSocketConfig {
    pub server_url: String,
    pub token: Option<String>,
    pub client_id: String,
    pub heartbeat_interval: u64,
    pub heartbeat_timeout: u64,
    pub max_reconnect_attempts: u32,
    pub reconnect_delay_ms: u64,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            server_url: String::new(),
            token: None,
            client_id: String::new(),
            heartbeat_interval: 9900, // 9.9초
            heartbeat_timeout: 15000, // 15초
            // 0은 무한 재연결을 의미
            max_reconnect_attempts: 0,
            reconnect_delay_ms: 1000, // 1초
        }
    }
}

/// 연결 건강 상태
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionHealth {
    pub is_healthy: bool,
    pub last_pong_time: Option<u64>,
    pub consecutive_failures: u32,
    pub round_trip_time: Option<u64>,
}

/// WebSocket 이벤트
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum WebSocketEvent {
    ConnectionStateChanged {
        state: ConnectionState,
        is_reconnection: bool,
    },
    MessageReceived {
        message: serde_json::Value,
    },
    HeartbeatStatusChanged {
        health: ConnectionHealth,
    },
    Error {
        message: String,
        details: Option<HashMap<String, serde_json::Value>>,
    },
}

/// WebSocket 요청 메시지
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WsRequest {
    pub data: serde_json::Value,
}

/// 재연결 구성
#[derive(Debug, Clone)]
pub struct ReconnectConfig {
    pub max_attempts: u32,
    pub initial_delay_ms: u64,
    pub max_delay_ms: u64,
    pub backoff_multiplier: f64,
}

impl Default for ReconnectConfig {
    fn default() -> Self {
        Self {
            max_attempts: 10,
            initial_delay_ms: 1000,
            max_delay_ms: 15000,
            backoff_multiplier: 1.5,
        }
    }
}
