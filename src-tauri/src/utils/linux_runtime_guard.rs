use std::fs;

/// Linux(WebKitGTK/Wry)에 대한 런타임 보호
pub fn apply_runtime_guards() {
    sanitize_sensitive_env();
    enforce_debugger_policy();
}

fn sanitize_sensitive_env() {
    const BLOCKED_VARS: [&str; 9] = [
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER",
        "WEBVIEW2_USER_DATA_FOLDER",
        "WEBVIEW2_WAIT_FOR_SCRIPT_DEBUGGER",
        "WEBKIT_FORCE_SANDBOX",
        "WEBKIT_INSPECTOR_SERVER",
        "GTK_DEBUG",
        "LD_PRELOAD",
        "LD_LIBRARY_PATH",
    ];

    BLOCKED_VARS.iter().for_each(|key| unsafe {
        std::env::remove_var(key);
    });
}

fn enforce_debugger_policy() {
    #[cfg(not(debug_assertions))]
    {
        if set_dumpable(false).is_err() {
            eprintln!("[HuLa] Linux dumpable 보호를 설정할 수 없습니다.");
        }

        if debugger_attached() {
            eprintln!("[HuLa] 디버거 감지됨 (Linux), 시작이 종료되었습니다.");
            std::process::exit(0);
        }
    }

    #[cfg(debug_assertions)]
    {
        if debugger_attached() {
            eprintln!("[HuLa] 디버그 모드: 디버거 연결 감지됨 (Linux).");
        }
    }
}

#[cfg(not(debug_assertions))]
fn set_dumpable(enabled: bool) -> Result<(), ()> {
    unsafe {
        if libc::prctl(libc::PR_SET_DUMPABLE, enabled as libc::c_ulong, 0, 0, 0) == -1 {
            return Err(());
        }
        Ok(())
    }
}

fn debugger_attached() -> bool {
    if let Ok(status) = fs::read_to_string("/proc/self/status") {
        for line in status.lines() {
            if let Some(value) = line.strip_prefix("TracerPid:") {
                return value.trim() != "0";
            }
        }
    }
    false
}
