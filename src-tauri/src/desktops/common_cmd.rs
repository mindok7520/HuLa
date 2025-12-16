#![allow(unexpected_cfgs)]
use base64::{Engine as _, engine::general_purpose};
use screenshots::Screen;
use std::cmp;
use std::thread;
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, LogicalSize, Manager, ResourceId, Runtime, Webview};

#[cfg(target_os = "macos")]
use objc2::rc::Retained;
#[cfg(target_os = "macos")]
use objc2_app_kit::NSWindow;
#[cfg(target_os = "windows")]
use serde::Serialize;
#[cfg(target_os = "macos")]
use tauri::WebviewWindow;

/// Windows 텍스트 스케일링 정보 구조체
#[cfg(target_os = "windows")]
#[derive(Serialize)]
pub struct WindowsScaleInfo {
    /// 시스템 DPI
    pub system_dpi: u32,
    /// 시스템 스케일링 비율
    pub system_scale: f64,
    /// 텍스트 스케일링 비율
    pub text_scale: f64,
    /// 텍스트 스케일링 감지 여부
    pub has_text_scaling: bool,
}
// // 사용자 정보 구조체 정의
// #[derive(Debug, Clone, Serialize)]
// pub struct UserInfo {
//     user_id: i64,
//     username: String,
//     token: String,
//     portrait: String,
//     is_sign: bool,
// }

// impl Default for UserInfo {
//     fn default() -> Self {
//         UserInfo {
//             user_id: -1,
//             username: String::new(),
//             token: String::new(),
//             portrait: String::new(),
//             is_sign: false,
//         }
//     }
// }

// // 전역 변수
// lazy_static! {
//     static ref USER_INFO: Arc<RwLock<UserInfo>> = Arc::new(RwLock::new(UserInfo::default()));
// }

#[tauri::command]
pub fn default_window_icon<R: Runtime>(
    webview: Webview<R>,
    app: AppHandle<R>,
) -> Option<ResourceId> {
    app.default_window_icon().cloned().map(|icon| {
        let mut resources_table = webview.resources_table();
        resources_table.add(icon.to_owned())
    })
}

#[tauri::command]
pub fn screenshot(x: &str, y: &str, width: &str, height: &str) -> Result<String, String> {
    let screen = Screen::from_point(100, 100).map_err(|e| format!("화면 정보 가져오기 실패: {}", e))?;

    let x = x
        .parse::<i32>()
        .map_err(|_| "유효하지 않은 x 좌표 매개변수".to_string())?;
    let y = y
        .parse::<i32>()
        .map_err(|_| "유효하지 않은 y 좌표 매개변수".to_string())?;
    let width = width
        .parse::<u32>()
        .map_err(|_| "유효하지 않은 너비 매개변수".to_string())?;
    let height = height
        .parse::<u32>()
        .map_err(|_| "유효하지 않은 높이 매개변수".to_string())?;

    let image = screen
        .capture_area(x, y, width, height)
        .map_err(|e| format!("스크린샷 실패: {}", e))?;

    let buffer = image.as_raw();
    let base64_str = general_purpose::STANDARD_NO_PAD.encode(buffer);
    Ok(base64_str)
}

#[tauri::command]
pub fn audio(filename: &str, handle: AppHandle) -> Result<(), String> {
    let path = "audio/".to_string() + filename;
    let handle_clone = handle.clone();

    thread::spawn(move || {
        if let Err(e) = play_audio_internal(&path, &handle_clone) {
            tracing::error!("Audio playback failed: {}", e);
        }
    });

    Ok(())
}

fn play_audio_internal(path: &str, handle: &AppHandle) -> Result<(), String> {
    use rodio::Decoder;
    use std::fs::File;
    use std::io::BufReader;

    let audio_path = handle
        .path()
        .resolve(path, BaseDirectory::Resource)
        .map_err(|e| format!("오디오 경로 파싱 실패: {}", e))?;

    let audio = File::open(audio_path).map_err(|e| format!("오디오 파일 열기 실패: {}", e))?;

    let file = BufReader::new(audio);
    let stream = rodio::OutputStreamBuilder::open_default_stream()
        .map_err(|e| format!("오디오 출력 스트림 생성 실패: {}", e))?;
    let source = Decoder::new(file).map_err(|e| format!("오디오 파일 디코딩 실패: {}", e))?;

    stream.mixer().add(source);
    thread::sleep(Duration::from_millis(3000));
    Ok(())
}

#[tauri::command]
pub fn set_height(height: u32, handle: AppHandle) -> Result<(), String> {
    let home_window = handle
        .get_webview_window("home")
        .ok_or("home 창을 찾을 수 없음")?;

    let sf = home_window
        .scale_factor()
        .map_err(|e| format!("창 스케일링 팩터 가져오기 실패: {}", e))?;

    let out_size = home_window
        .inner_size()
        .map_err(|e| format!("창 크기 가져오기 실패: {}", e))?;

    home_window
        .set_size(LogicalSize::new(
            out_size.to_logical(sf).width,
            cmp::max(out_size.to_logical(sf).height, height),
        ))
        .map_err(|e| format!("창 높이 설정 실패: {}", e))?;

    Ok(())
}

/// macOS 신호등 버튼의 가시성 설정
#[cfg(target_os = "macos")]
fn set_traffic_lights_hidden(
    ns_window: &NSWindow,
    hidden: bool,
    btn: objc2_app_kit::NSWindowButton,
) {
    if let Some(button) = ns_window.standardWindowButton(btn) {
        button.setHidden(hidden);
    }
}

#[cfg(target_os = "macos")]
fn set_window_movable_state(ns_window: &NSWindow, movable: bool) {
    ns_window.setMovable(movable);
    ns_window.setMovableByWindowBackground(movable);
}

/// Mac 창의 제목 표시줄 버튼(신호등 버튼)과 제목 숨기기
///
/// # 매개변수
/// * `window_label` - 창의 레이블 이름
/// * `hide_close_button` - 선택적 매개변수, 닫기 버튼 숨김 여부, 기본값은 false(숨기지 않음)
/// * `handle` - Tauri 앱 핸들
///
/// # 반환
/// * `Result<(), String>` - 성공 시 Ok(()), 실패 시 오류 메시지 반환
#[tauri::command]
#[cfg(target_os = "macos")]
pub fn hide_title_bar_buttons(
    window_label: &str,
    hide_close_button: Option<bool>,
    handle: AppHandle,
) -> Result<(), String> {
    use objc2_app_kit::NSWindowButton;

    let webview_window = get_webview_window(&handle, window_label)?;
    let ns_window = get_nswindow_from_webview_window(&webview_window)?;

    // 제목 표시줄 버튼 숨기기 보조 함수
    set_traffic_lights_hidden(&ns_window, true, NSWindowButton::MiniaturizeButton);
    set_traffic_lights_hidden(&ns_window, true, NSWindowButton::ZoomButton);
    // 매개변수에 따라 닫기 버튼 숨김 여부 결정
    if hide_close_button.unwrap_or(false) {
        set_traffic_lights_hidden(&ns_window, true, NSWindowButton::CloseButton);
    }

    // 창 드래그 불가 설정
    set_window_movable_state(&ns_window, false);
    Ok(())
}

/// Mac 창의 제목 표시줄 버튼 표시 복원
///
/// # 매개변수
/// * `window_label` - 창의 레이블 이름
/// * `handle` - Tauri 앱 핸들
///
/// # 반환
/// * `Result<(), String>` - 성공 시 Ok(()), 실패 시 오류 메시지 반환
#[tauri::command]
#[cfg(target_os = "macos")]
pub fn show_title_bar_buttons(window_label: &str, handle: AppHandle) -> Result<(), String> {
    use objc2_app_kit::NSWindowButton;

    let webview_window = get_webview_window(&handle, window_label)?;
    let ns_window = get_nswindow_from_webview_window(&webview_window)?;

    // 모든 제목 표시줄 버튼 표시
    set_traffic_lights_hidden(&ns_window, false, NSWindowButton::CloseButton);
    set_traffic_lights_hidden(&ns_window, false, NSWindowButton::MiniaturizeButton);
    set_traffic_lights_hidden(&ns_window, false, NSWindowButton::ZoomButton);
    // 창 드래그 가능 복원
    set_window_movable_state(&ns_window, true);
    Ok(())
}

/// macOS 창 드래그 가능 여부 설정
#[tauri::command]
#[cfg(target_os = "macos")]
pub fn set_window_movable(
    window_label: &str,
    movable: bool,
    handle: AppHandle,
) -> Result<(), String> {
    let webview_window = get_webview_window(&handle, window_label)?;
    let ns_window = get_nswindow_from_webview_window(&webview_window)?;
    set_window_movable_state(&ns_window, movable);
    Ok(())
}

#[tauri::command]
pub fn set_badge_count(count: Option<i64>, handle: AppHandle) -> Result<(), String> {
    // home 창을 찾을 수 없는 경우, 오류를 발생시키지 않고 성공 반환
    if let Some(window) = handle.get_webview_window("home") {
        window.set_badge_count(count).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// macOS 창 레벨을 화면 보호기 레벨로 설정하여 메뉴 표시줄을 덮음
#[tauri::command]
#[cfg(target_os = "macos")]
pub fn set_window_level_above_menubar(window_label: &str, handle: AppHandle) -> Result<(), String> {
    let webview_window = get_webview_window(&handle, window_label)?;
    let ns_window = get_nswindow_from_webview_window(&webview_window)?;

    // 창 레벨을 화면 보호기 레벨(1000)로 설정, 메뉴 표시줄보다 높음
    ns_window.setLevel(objc2_app_kit::NSScreenSaverWindowLevel);
    Ok(())
}

#[cfg(target_os = "macos")]
fn get_webview_window(handle: &AppHandle, window_label: &str) -> Result<WebviewWindow, String> {
    handle
        .get_webview_window(window_label)
        .ok_or_else(|| format!("Window '{}' not found", window_label))
}

#[cfg(target_os = "macos")]
fn get_nswindow_from_webview_window(
    webview_window: &WebviewWindow,
) -> Result<Retained<NSWindow>, String> {
    webview_window
        .ns_window()
        .map_err(|e| format!("Failed to get NSWindow: {}", e))
        .map(|ptr| unsafe { Retained::retain(ptr as *mut NSWindow) })?
        .ok_or_else(|| "Failed to retain NSWindow".to_string())
}

/// Windows 시스템 및 텍스트 스케일링 정보 가져오기
#[tauri::command]
#[cfg(target_os = "windows")]
pub fn get_windows_scale_info() -> Result<WindowsScaleInfo, String> {
    use windows::Win32::UI::HiDpi::GetDpiForSystem;

    unsafe {
        // 시스템 DPI 가져오기
        let system_dpi = GetDpiForSystem();
        let standard_dpi = 96.0; // Windows 표준 DPI
        let system_scale = system_dpi as f64 / standard_dpi;

        // 레지스트리에서 텍스트 스케일링 설정 읽기
        let text_scale = get_text_scale_from_registry().unwrap_or(1.0);

        // 텍스트 스케일링 존재 여부 감지 (허용 오차 1%)
        let has_text_scaling = (text_scale - 1.0).abs() > 0.01;

        Ok(WindowsScaleInfo {
            system_dpi,
            system_scale,
            text_scale,
            has_text_scaling,
        })
    }
}

/// Windows 레지스트리에서 텍스트 스케일링 설정 읽기
#[cfg(target_os = "windows")]
unsafe fn get_text_scale_from_registry() -> Result<f64, String> {
    use windows::Win32::System::Registry::{
        HKEY, HKEY_CURRENT_USER, KEY_READ, REG_DWORD, RegCloseKey, RegOpenKeyExW, RegQueryValueExW,
    };
    use windows::core::w;

    // 여러 가능한 레지스트리 위치 시도
    let registry_paths = [
        w!("Control Panel\\Desktop\\WindowMetrics"),
        w!("Software\\Microsoft\\Accessibility"),
        w!("Control Panel\\Desktop"),
    ];

    let value_names = [
        w!("TextScaleFactor"),
        w!("TextScaleFactor"),
        w!("LogPixels"),
    ];

    for (i, &subkey) in registry_paths.iter().enumerate() {
        let mut hkey: HKEY = HKEY::default();
        let result =
            unsafe { RegOpenKeyExW(HKEY_CURRENT_USER, subkey, Some(0), KEY_READ, &mut hkey) };

        if result.is_ok() {
            let value_name = value_names[i];
            let mut data: u32 = 0;
            let mut data_size = std::mem::size_of::<u32>() as u32;
            let mut value_type = REG_DWORD;

            let result = unsafe {
                RegQueryValueExW(
                    hkey,
                    value_name,
                    None,
                    Some(&mut value_type),
                    Some(&mut data as *mut u32 as *mut u8),
                    Some(&mut data_size),
                )
            };

            let _ = unsafe { RegCloseKey(hkey) };

            if result.is_ok() && value_type == REG_DWORD && data > 0 {
                if i == 2 {
                    // LogPixels는 DPI 값이며, 특별한 처리가 필요함
                    return Ok(1.0); // LogPixels는 텍스트 스케일링이 아니므로 기본값 반환
                } else {
                    // TextScaleFactor는 백분율 값 (100 = 100%, 150 = 150%)
                    return Ok(data as f64 / 100.0);
                }
            }
        }
    }
    Ok(1.0)
}
