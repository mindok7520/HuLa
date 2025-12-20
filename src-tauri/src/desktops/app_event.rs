#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager, RunEvent, Runtime};

/// macOS 시스템에서 앱이 다시 열릴 때, 가시적인 창이 없으면 기존의 home 창을 우선적으로 표시합니다.
#[cfg(target_os = "macos")]
pub fn handle_app_event<R: Runtime>(app_handle: &AppHandle<R>, event: RunEvent) {
    match event {
        RunEvent::Reopen { .. } => {
            // 즉시 home 창을 가져와서 존재하면 표시하고 가장 앞으로 가져옵니다.
            if let Some(home_window) = app_handle.get_webview_window("home") {
                let _ = home_window.show();
                let _ = home_window.unminimize();
                let _ = home_window.set_focus();
            }
        }
        _ => {}
    }
}
