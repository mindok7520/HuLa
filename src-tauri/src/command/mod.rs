use tauri::{AppHandle, State};

use crate::AppData;

pub mod ai_command;
pub mod app_state_command;
pub mod chat_history_command;
pub mod contact_command;
pub mod file_manager_command;
pub mod markdown_command;
pub mod message_command;
pub mod message_mark_command;
pub mod request_command;
pub mod room_member_command;
pub mod setting_command;
pub mod user_command;

// A custom task for setting the state of a setup task
#[tauri::command]
pub async fn set_complete(
    _app: AppHandle,
    state: State<'_, AppData>,
    task: String,
) -> Result<(), ()> {
    tracing::info!("set_complete: {}", task);
    match task.as_str() {
        "frontend" => *state.frontend_task.lock().await = true,
        "backend" => *state.backend_task.lock().await = true,
        _ => panic!("invalid task completed!"),
    }
    // 시작 화면을 자동으로 숨기지 않음, 프론트엔드 페이지 렌더링이 완료된 후 능동적으로 hide_splash_screen 호출
    tracing::info!("set_complete {}: {:?}", task, state.frontend_task);
    tracing::info!("set_complete {}: {:?}", task, state.backend_task);
    Ok(())
}
