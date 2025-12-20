use std::sync::atomic::Ordering;

use crate::APP_STATE_READY;

/// 프런트엔드 쿼리에 제공되는 명령으로, Rust 측에서 AppData 주입이 완료되었는지 확인하는 데 사용됩니다.
/// 시작 단계에서 초기화가 완료되지 않은 경우 이 명령은 false를 반환하며, 프런트엔드는 상태에 의존하는 인터페이스 호출을 지연시킬 수 있습니다.
#[tauri::command]
pub fn is_app_state_ready() -> bool {
    APP_STATE_READY.load(Ordering::SeqCst)
}
