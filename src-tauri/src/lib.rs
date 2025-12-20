// 데스크톱 의존성
#[cfg(desktop)]
mod desktops;
use crate::common::files_meta::get_files_meta;
#[cfg(desktop)]
use common::init::CustomInit;
#[cfg(target_os = "windows")]
use common_cmd::get_windows_scale_info;
#[cfg(desktop)]
use common_cmd::{audio, default_window_icon, screenshot, set_height};
#[cfg(target_os = "macos")]
use common_cmd::{
    hide_title_bar_buttons, set_window_level_above_menubar, set_window_movable,
    show_title_bar_buttons,
};
#[cfg(target_os = "macos")]
use desktops::app_event;
#[cfg(desktop)]
use desktops::window_payload::{get_window_payload, push_window_payload};
#[cfg(desktop)]
use desktops::{common_cmd, directory_scanner, init, tray, video_thumbnail::get_video_thumbnail};
#[cfg(desktop)]
use directory_scanner::{cancel_directory_scan, get_directory_usage_info_with_progress};
#[cfg(desktop)]
use init::DesktopCustomInit;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri_plugin_fs::FsExt;
pub mod command;
pub mod common;
pub mod configuration;
pub mod error;
mod im_request_client;
pub mod pojo;
pub mod repository;
pub mod timeout_config;
pub mod utils;
mod vo;
pub mod websocket;
#[cfg(target_os = "ios")]
mod webview_helper;

use crate::command::app_state_command::is_app_state_ready;
use crate::command::request_command::{im_request_command, login_command};
use crate::command::room_member_command::{
    cursor_page_room_members, get_room_members, page_room, update_my_room_info,
};
use crate::command::setting_command::{get_settings, update_settings};
use crate::command::user_command::remove_tokens;
use crate::configuration::{Settings, get_configuration};
use crate::error::CommonError;
use sea_orm::DatabaseConnection;
use serde::{Deserialize, Serialize};

// 모바일 의존성
#[cfg(mobile)]
use common::init::CustomInit;
#[cfg(mobile)]
mod mobiles;
#[cfg(mobile)]
use mobiles::splash;

#[derive(Debug)]
pub struct AppData {
    db_conn: Arc<DatabaseConnection>,
    user_info: Arc<Mutex<UserInfo>>,
    pub rc: Arc<Mutex<im_request_client::ImRequestClient>>,
    pub config: Arc<Mutex<Settings>>,
    frontend_task: Mutex<bool>,
    backend_task: Mutex<bool>,
    /// SQLite 쓰기 병행 처리를 제한하여 database is locked 방지
    pub write_lock: Arc<Mutex<()>>,
    /// 진행 중인 AI 스트리밍 작업 기록
    pub stream_tasks: Arc<Mutex<std::collections::HashMap<String, tokio::task::JoinHandle<()>>>>,
}

pub(crate) static APP_STATE_READY: AtomicBool = AtomicBool::new(false);

use crate::command::chat_history_command::query_chat_history;
use crate::command::contact_command::{hide_contact_command, list_contacts_command};
use crate::command::file_manager_command::{
    debug_message_stats, get_navigation_items, query_files,
};
use crate::command::message_command::{
    delete_message, delete_room_messages, page_msg, save_msg, send_msg, sync_messages,
    update_message_recall_status,
};
use crate::command::message_mark_command::save_message_mark;

#[cfg(desktop)]
use tauri::Listener;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Mutex;

pub fn run() {
    #[cfg(desktop)]
    {
        if let Err(e) = setup_desktop() {
            tracing::error!("Failed to setup desktop application: {}", e);
            std::process::exit(1);
        }
    }
    #[cfg(mobile)]
    {
        setup_mobile();
    }
}

#[cfg(desktop)]
fn setup_desktop() -> Result<(), CommonError> {
    // 캐시 인스턴스 생성
    // let cache: Cache<String, String> = Cache::builder()
    //     // Time to idle (TTI):  30 minutes
    //     .time_to_idle(Duration::from_secs(30 * 60))
    //     // Create the cache.
    //     .build();
    tauri::Builder::default()
        .init_plugin()
        .init_webwindow_event()
        .init_window_event()
        .setup(move |app| {
            common_setup(app.handle().clone())?;
            Ok(())
        })
        .invoke_handler(get_invoke_handlers())
        .build(tauri::generate_context!())
        .map_err(|e| {
            CommonError::RequestError(format!("Failed to build tauri application: {}", e))
        })?
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            app_event::handle_app_event(&app_handle, event);
            #[cfg(not(target_os = "macos"))]
            {
                let _ = (app_handle, event);
            }
        });
    Ok(())
}

// 애플리케이션 데이터 비동기 초기화
async fn initialize_app_data(
    app_handle: tauri::AppHandle,
) -> Result<
    (
        Arc<DatabaseConnection>,
        Arc<Mutex<UserInfo>>,
        Arc<Mutex<im_request_client::ImRequestClient>>,
        Arc<Mutex<Settings>>,
    ),
    CommonError,
> {
    use migration::{Migrator, MigratorTrait};
    use tracing::info;

    // 설정 로드
    let configuration =
        Arc::new(Mutex::new(get_configuration(&app_handle).map_err(|e| {
            anyhow::anyhow!("Failed to load configuration: {}", e)
        })?));

    // 데이터베이스 연결 초기화
    let db: Arc<DatabaseConnection> = Arc::new(
        configuration
            .lock()
            .await
            .database
            .connection_string(&app_handle)
            .await?,
    );

    // 데이터베이스 마이그레이션
    match Migrator::up(db.as_ref(), None).await {
        Ok(_) => {
            info!("Database migration completed");
        }
        Err(e) => {
            eprintln!("Warning: Database migration failed: {}", e);
        }
    }

    let rc: im_request_client::ImRequestClient = im_request_client::ImRequestClient::new(
        configuration.lock().await.backend.base_url.clone(),
    )
    .unwrap();

    // 사용자 정보 생성
    let user_info = UserInfo {
        token: Default::default(),
        refresh_token: Default::default(),
        uid: Default::default(),
    };
    let user_info = Arc::new(Mutex::new(user_info));

    Ok((db, user_info, Arc::new(Mutex::new(rc)), configuration))
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UserInfo {
    pub token: String,
    pub refresh_token: String,
    pub uid: String,
}

pub async fn build_request_client() -> Result<reqwest::Client, CommonError> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow::anyhow!("Reqwest client error: {}", e))?;
    Ok(client)
}

/// 로그아웃 시 창 관리 로직 처리
///
/// 이 함수는 다음을 수행합니다:
/// - login/tray를 제외한 대부분의 창을 닫습니다.
/// - capture/checkupdate 창은 숨기기만 하고 유지합니다.
/// - 창 닫기 과정 중의 오류를 우아하게 처리합니다.
#[cfg(desktop)]
pub async fn handle_logout_windows(app_handle: &tauri::AppHandle) {
    tracing::info!("[LOGOUT] Starting to close windows and preserve capture/checkupdate windows");

    let all_windows = app_handle.webview_windows();
    tracing::info!("[LOGOUT] Found {} windows", all_windows.len());

    // 닫아야 할 창과 숨겨야 할 창 수집
    let mut windows_to_close = Vec::new();
    let mut windows_to_hide = Vec::new();

    for (label, window) in all_windows {
        match label.as_str() {
            // 이 창들은 전혀 처리하지 않음
            "login" | "tray" => {
                tracing::info!("[LOGOUT] Skipping window: {}", label);
            }
            // 이 창들은 숨기기만 하고 소멸시키지 않음
            "capture" | "checkupdate" => {
                tracing::info!("[LOGOUT] Marking window for preservation: {}", label);
                windows_to_hide.push((label, window));
            }
            // 다른 창들은 닫아야 함
            _ => {
                tracing::info!("[LOGOUT] Marking window for closure: {}", label);
                windows_to_close.push((label, window));
            }
        }
    }

    // 유지해야 할 창들을 먼저 숨김
    for (label, window) in windows_to_hide {
        tracing::info!("[LOGOUT] Hiding window (preserving): {}", label);
        if let Err(e) = window.hide() {
            tracing::warn!("[LOGOUT] Failed to hide window {}: {}", label, e);
        }
    }

    // 창을 하나씩 닫되, 병행 종료로 인한 오류를 방지하기 위해 짧은 지연 시간 추가
    for (label, window) in windows_to_close {
        tracing::info!("[LOGOUT] Closing window: {}", label);

        // 사용자 체감 지연을 줄이기 위해 먼저 창을 숨깁니다.
        let _ = window.hide();

        // 진행 중인 작업을 처리할 시간을 주기 위해 짧은 지연 시간을 추가합니다.
        // tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;

        match window.destroy() {
            Ok(_) => {
                tracing::info!("[LOGOUT] Successfully closed window: {}", label);
            }
            Err(error) => {
                // 창이 아직 존재하는지 확인
                if app_handle.get_webview_window(&label).is_none() {
                    tracing::info!(
                        "[LOGOUT] Window {} no longer exists, skipping closure",
                        label
                    );
                } else {
                    tracing::warn!(
                        "[LOGOUT] Warning when closing window {}: {} (this is usually normal)",
                        label,
                        error
                    );
                }
            }
        }
    }

    tracing::info!(
        "[LOGOUT] Logout completed - windows closed and capture/checkupdate windows preserved"
    );
}

// 로그아웃 이벤트 리스너 설정
#[cfg(desktop)]
fn setup_logout_listener(app_handle: tauri::AppHandle) {
    let app_handle_clone = app_handle.clone();
    app_handle.listen("logout", move |_event| {
        let app_handle = app_handle_clone.clone();
        tauri::async_runtime::spawn(async move {
            handle_logout_windows(&app_handle).await;
        });
    });
}

#[cfg(mobile)]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn setup_mobile() {
    splash::show();
    // 캐시 인스턴스 생성
    // let cache: Cache<String, String> = Cache::builder()
    //     // Time to idle (TTI):  30 minutes
    //     .time_to_idle(Duration::from_secs(30 * 60))
    //     // Create the cache.
    //     .build();

    if let Err(e) = tauri::Builder::default()
        .init_plugin()
        .setup(move |app| {
            let app_handle = app.handle().clone();
            #[cfg(target_os = "ios")]
            {
                if let Some(webview_window) = app_handle.get_webview_window("mobile-home") {
                    webview_helper::initialize_keyboard_adjustment(&webview_window);
                } else {
                    tracing::warn!("Mobile home webview window not found during setup");
                }
            }
            common_setup(app_handle)?;
            tracing::info!("Mobile application setup completed successfully");
            Ok(())
        })
        .invoke_handler(get_invoke_handlers())
        .run(tauri::generate_context!())
    {
        tracing::log::error!("Failed to run mobile application: {}", e);
        std::process::exit(1);
    }
}

// 공용 setup 함수
fn common_setup(app_handle: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let scope = app_handle.fs_scope();
    scope.allow_directory("configuration", false).unwrap();

    #[cfg(desktop)]
    setup_logout_listener(app_handle.clone());

    // 메인 스레드 차단을 피하기 위해 애플리케이션 데이터를 비동기적으로 초기화
    match tauri::async_runtime::block_on(initialize_app_data(app_handle.clone())) {
        Ok((db, user_info, rc, settings)) => {
            // manage 메서드를 사용하여 실행 중에 상태 추가
            app_handle.manage(AppData {
                db_conn: db.clone(),
                user_info: user_info.clone(),
                rc: rc,
                config: settings,
                frontend_task: Mutex::new(false),
                // 백엔드 작업 기본 완료
                backend_task: Mutex::new(true),
                write_lock: Arc::new(Mutex::new(())),
                stream_tasks: Arc::new(Mutex::new(std::collections::HashMap::new())),
            });
            APP_STATE_READY.store(true, Ordering::SeqCst);
            if let Err(e) = app_handle.emit("app-state-ready", ()) {
                tracing::warn!("Failed to emit app-state-ready event: {}", e);
            }
        }
        Err(e) => {
            tracing::error!("Failed to initialize application data: {}", e);
            return Err(format!("Failed to initialize app data: {}", e).into());
        }
    }

    #[cfg(desktop)]
    tray::create_tray(&app_handle)?;
    Ok(())
}

// 공용 명령 처리기 함수
fn get_invoke_handlers() -> impl Fn(tauri::ipc::Invoke<tauri::Wry>) -> bool + Send + Sync + 'static
{
    use crate::command::ai_command::ai_message_cancel_stream;
    use crate::command::ai_command::ai_message_send_stream;
    use crate::command::markdown_command::{get_readme_html, parse_markdown};
    #[cfg(mobile)]
    use crate::command::set_complete;
    use crate::command::user_command::{
        get_user_tokens, save_user_info, update_token, update_user_last_opt_time,
    };
    #[cfg(target_os = "ios")]
    use crate::mobiles::keyboard::set_webview_keyboard_adjustment;
    #[cfg(mobile)]
    use crate::mobiles::splash::hide_splash_screen;
    use crate::websocket::commands::{
        ws_disconnect, ws_force_reconnect, ws_get_app_background_state, ws_get_health,
        ws_get_state, ws_init_connection, ws_is_connected, ws_send_message,
        ws_set_app_background_state, ws_update_config,
    };

    tauri::generate_handler![
        // 데스크톱 전용 명령
        #[cfg(desktop)]
        default_window_icon,
        #[cfg(desktop)]
        screenshot,
        #[cfg(desktop)]
        audio,
        #[cfg(desktop)]
        set_height,
        #[cfg(desktop)]
        get_video_thumbnail,
        #[cfg(target_os = "macos")]
        hide_title_bar_buttons,
        #[cfg(target_os = "macos")]
        show_title_bar_buttons,
        #[cfg(target_os = "macos")]
        set_window_level_above_menubar,
        #[cfg(target_os = "macos")]
        set_window_movable,
        #[cfg(desktop)]
        push_window_payload,
        #[cfg(desktop)]
        get_window_payload,
        get_files_meta,
        #[cfg(desktop)]
        get_directory_usage_info_with_progress,
        #[cfg(desktop)]
        cancel_directory_scan,
        #[cfg(target_os = "windows")]
        get_windows_scale_info,
        // 공용 명령 (데스크톱 및 모바일 지원)
        save_user_info,
        get_user_tokens,
        update_token,
        remove_tokens,
        update_user_last_opt_time,
        page_room,
        get_room_members,
        update_my_room_info,
        cursor_page_room_members,
        list_contacts_command,
        hide_contact_command,
        page_msg,
        sync_messages,
        send_msg,
        save_msg,
        delete_message,
        delete_room_messages,
        update_message_recall_status,
        save_message_mark,
        // 채팅 기록 관련 명령
        query_chat_history,
        // 파일 관리 관련 명령
        query_files,
        get_navigation_items,
        debug_message_stats,
        // WebSocket 관련 명령
        ws_init_connection,
        ws_disconnect,
        ws_send_message,
        ws_get_state,
        ws_get_health,
        ws_force_reconnect,
        ws_update_config,
        ws_is_connected,
        ws_set_app_background_state,
        ws_get_app_background_state,
        login_command,
        im_request_command,
        get_settings,
        update_settings,
        // AI 관련 명령
        ai_message_send_stream,
        ai_message_cancel_stream,
        // Markdown 관련 명령
        parse_markdown,
        get_readme_html,
        #[cfg(mobile)]
        set_complete,
        #[cfg(mobile)]
        hide_splash_screen,
        #[cfg(target_os = "ios")]
        set_webview_keyboard_adjustment,
        is_app_state_ready,
    ]
}
