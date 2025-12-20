use serde_json::Value;
use std::collections::HashMap;
use tracing::debug;

/// 메시지 처리기
/// 다양한 유형의 WebSocket 메시지 처리 담당
pub struct MessageProcessor {
    message_handlers: HashMap<String, Box<dyn Fn(&Value) + Send + Sync>>,
}

impl MessageProcessor {
    pub fn new() -> Self {
        Self {
            message_handlers: HashMap::new(),
        }
    }

    /// 메시지 처리기 등록
    pub fn register_handler<F>(&mut self, message_type: String, handler: F)
    where
        F: Fn(&Value) + Send + Sync + 'static,
    {
        self.message_handlers
            .insert(message_type, Box::new(handler));
    }

    /// 받은 메시지 처리
    pub fn process_message(&self, message: &Value) -> ProcessResult {
        // 메시지 유형 파싱 시도
        if let Some(msg_type) = self.extract_message_type(message) {
            debug!("Processing message type: {}", msg_type);

            // 해당 처리기 찾기
            if let Some(handler) = self.message_handlers.get(&msg_type) {
                handler(message);
                return ProcessResult::Handled;
            } else {
                debug!("No handler found for message type {}", msg_type);
            }
        }

        ProcessResult::Unhandled
    }

    /// 메시지 유형 추출
    fn extract_message_type(&self, message: &Value) -> Option<String> {
        message.get("type").and_then(|t| {
            if let Some(s) = t.as_str() {
                Some(s.to_string())
            } else if let Some(n) = t.as_u64() {
                Some(n.to_string())
            } else {
                None
            }
        })
    }

    /// 메시지 형식 검증
    pub fn validate_message(&self, message: &Value) -> ValidationResult {
        // 기본 구조 검증
        if !message.is_object() {
            return ValidationResult::Invalid("Message must be an object".to_string());
        }

        // 필수 필드 확인
        if message.get("type").is_none() {
            return ValidationResult::Invalid("Message must have a 'type' field".to_string());
        }

        ValidationResult::Valid
    }

    /// 민감 정보 필터링
    pub fn sanitize_message(&self, mut message: Value) -> Value {
        // 잠재적인 민감 필드 제거
        if let Some(obj) = message.as_object_mut() {
            let sensitive_keys = ["password", "token", "secret", "key"];
            for key in sensitive_keys {
                if obj.contains_key(key) {
                    obj.insert(key.to_string(), Value::String("***".to_string()));
                }
            }
        }
        message
    }
}

impl Default for MessageProcessor {
    fn default() -> Self {
        let mut processor = Self::new();
        processor.register_default_handlers();
        processor
    }
}

impl MessageProcessor {
    /// 기본 메시지 처리기 등록
    fn register_default_handlers(&mut self) {
        // 로그인 관련 메시지
        self.register_handler("1".to_string(), |msg| {
            debug!("Processing login-related message: {:?}", msg);
        });

        // 하트비트 메시지
        self.register_handler("2".to_string(), |_msg| {
            debug!("Received heartbeat message");
        });

        self.register_handler("3".to_string(), |_msg| {
            debug!("Received heartbeat response");
        });

        // 일반 채팅 메시지
        self.register_handler("RECEIVE_MESSAGE".to_string(), |msg| {
            debug!("Received chat message: {:?}", msg);
        });

        // 사용자 상태 변경
        self.register_handler("USER_STATE_CHANGE".to_string(), |msg| {
            debug!("User status changed: {:?}", msg);
        });

        // 비디오 통화 관련
        self.register_handler("VideoCallRequest".to_string(), |msg| {
            debug!("Received video call request: {:?}", msg);
        });

        self.register_handler("CallAccepted".to_string(), |msg| {
            debug!("Call accepted: {:?}", msg);
        });

        self.register_handler("CallRejected".to_string(), |msg| {
            debug!(" Call rejected: {:?}", msg);
        });
    }
}

/// 메시지 처리 결과
#[derive(Debug, PartialEq)]
pub enum ProcessResult {
    Handled,
    Unhandled,
}

/// 메시지 검증 결과
#[derive(Debug, PartialEq)]
pub enum ValidationResult {
    Valid,
    Invalid(String),
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_message_validation() {
        let processor = MessageProcessor::new();

        // 유효한 메시지
        let valid_msg = json!({
            "type": "test",
            "data": "some data"
        });
        assert_eq!(
            processor.validate_message(&valid_msg),
            ValidationResult::Valid
        );

        // 유효하지 않은 메시지 - type 누락
        let invalid_msg = json!({
            "data": "some data"
        });
        assert!(matches!(
            processor.validate_message(&invalid_msg),
            ValidationResult::Invalid(_)
        ));

        // 유효하지 않은 메시지 - 객체가 아님
        let invalid_msg2 = json!("not an object");
        assert!(matches!(
            processor.validate_message(&invalid_msg2),
            ValidationResult::Invalid(_)
        ));
    }

    #[test]
    fn test_message_sanitization() {
        let processor = MessageProcessor::new();

        let sensitive_msg = json!({
            "type": "login",
            "password": "secret123",
            "token": "abc123",
            "data": "normal data"
        });

        let sanitized = processor.sanitize_message(sensitive_msg);
        assert_eq!(sanitized["password"], "***");
        assert_eq!(sanitized["token"], "***");
        assert_eq!(sanitized["data"], "normal data");
    }
}
