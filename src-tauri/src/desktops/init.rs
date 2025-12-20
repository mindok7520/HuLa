use crate::common::init::{CustomInit, init_common_plugins};
use tauri::{Manager, Runtime, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;

pub trait DesktopCustomInit {
    fn init_webwindow_event(self) -> Self;

    fn init_window_event(self) -> Self;
}

impl<R: Runtime> CustomInit for tauri::Builder<R> {
    // 플러그인 초기화
    fn init_plugin(self) -> Self {
        let builder = init_common_plugins(self);

        // 데스크톱 전용 플러그인
        #[cfg(desktop)]
        let builder = builder
            .plugin(tauri_plugin_autostart::init(
                MacosLauncher::LaunchAgent,
                Some(vec!["--flag1", "--flag2"]),
            ))
            .plugin(tauri_plugin_single_instance::init(|app, _args, _cmd| {
                let windows = app.webview_windows();
                // 기존의 home 창을 우선적으로 표시
                for (name, window) in windows {
                    if name == "home" {
                        if let Err(e) = window.show() {
                            tracing::warn!("Failed to show home window: {}", e);
                        }
                        if let Err(e) = window.unminimize() {
                            tracing::warn!("Failed to unminimize home window: {}", e);
                        }
                        if let Err(e) = window.set_focus() {
                            tracing::warn!("Failed to focus home window: {}", e);
                        }
                        break;
                    }
                }
            }))
            .plugin(tauri_plugin_global_shortcut::Builder::new().build())
            .plugin(tauri_plugin_updater::Builder::new().build());

        // #[cfg(debug_assertions)]
        // let builder = builder.plugin(tauri_plugin_devtools::init());

        builder
    }
}

impl<R: Runtime> DesktopCustomInit for tauri::Builder<R> {
    // 웹 창 이벤트 초기화
    fn init_webwindow_event(self) -> Self {
        self.on_webview_event(|_, event| match event {
            _ => (),
        })
    }

    // 시스템 창 이벤트 초기화
    fn init_window_event(self) -> Self {
        self.on_window_event(|window, event: &WindowEvent| match event {
            WindowEvent::Focused(flag) => {
                // 사용자 정의 시스템 트레이 - 트레이 메뉴가 포커스를 잃었을 때 숨기기 구현
                #[cfg(not(target_os = "macos"))]
                if !window.label().eq("tray") && *flag {
                    if let Some(tray_window) = window.app_handle().get_webview_window("tray") {
                        let _ = tray_window.hide();
                    }
                }
                if window.label().eq("tray") && !flag {
                    if let Err(e) = window.hide() {
                        tracing::warn!("Failed to hide tray window: {}", e);
                    }
                }
                #[cfg(target_os = "windows")]
                if !window.label().eq("notify") && *flag {
                    if let Some(notify_window) = window.app_handle().get_webview_window("notify") {
                        let _ = notify_window.hide();
                    }
                }
                #[cfg(target_os = "windows")]
                if window.label().eq("notify") && !flag {
                    if let Err(e) = window.hide() {
                        tracing::warn!("Failed to hide notify window: {}", e);
                    }
                }
            }
            WindowEvent::CloseRequested { .. } => {
                let app_handle = window.app_handle();
                let windows = app_handle.webview_windows();
                let win_label = window.label();

                // 유효하지 않은 창(중요하지 않거나 종료 가능한 창)인지 확인
                let is_ignored_window =
                    |name: &str| matches!(name, "checkupdate" | "capture" | "update" | "tray");

                if win_label.eq("update") {
                    let state: tauri::State<'_, crate::AppData> = window.state();
                    let user_info = state.user_info.clone();

                    let has_other_active_windows =
                        windows.iter().any(|(name, _)| !is_ignored_window(name));

                    let app_handle = app_handle.clone();

                    tauri::async_runtime::spawn(async move {
                        let user_info = user_info.lock().await;
                        let not_logg_in = user_info.uid.trim().is_empty();

                        //  update 창 닫힘 + 로그인 안 됨 + 다른 유효한 창 없음 => 프로그램 종료
                        if not_logg_in && !has_other_active_windows {
                            app_handle.exit(0);
                        }
                    });
                }
                // login 창이 사용자에 의해 닫히면 프로그램을 즉시 종료
                else if win_label.eq("login") {
                    // 다른 창이 존재하는지 확인, home 창이 있으면 로그인 성공 후의 정상적인 닫힘임
                    let has_home_or_update = windows
                        .iter()
                        .any(|(name, _)| matches!(name.as_str(), "home" | "update"));

                    if !has_home_or_update {
                        // home 창이 없으면 사용자가 login 창을 직접 닫은 것이므로 프로그램 종료
                        window.app_handle().exit(0);
                    }
                    // home 창이 있으면 로그인 성공 후의 정상적인 닫힘이므로 닫기 허용
                }
            }
            WindowEvent::Resized(_ps) => {}
            _ => (),
        })
    }
}
