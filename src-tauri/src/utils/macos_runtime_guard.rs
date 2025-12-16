/// macOS(WKWebView)에 대한 런타임 보호
pub fn apply_runtime_guards() {
    sanitize_sensitive_env();
    enforce_debugger_policy();
}

fn sanitize_sensitive_env() {
    const BLOCKED_VARS: [&str; 6] = [
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER",
        "WEBVIEW2_USER_DATA_FOLDER",
        "WEBVIEW2_WAIT_FOR_SCRIPT_DEBUGGER",
        "WEBKIT_INSPECTOR_SERVER",
        "DYLD_INSERT_LIBRARIES",
    ];

    BLOCKED_VARS.iter().for_each(|key| unsafe {
        std::env::remove_var(key);
    });
}

fn enforce_debugger_policy() {
    #[cfg(not(debug_assertions))]
    {
        if prevent_debugger_attach().is_err() {
            eprintln!("[HuLa] 디버그 보호를 설정할 수 없습니다 (macOS).");
        }
    }

    #[cfg(debug_assertions)]
    {
        eprintln!("[HuLa] 디버그 빌드: macOS 런타임 보호는 힌트만 기록하며 디버깅을 차단하지 않습니다.");
    }
}

#[cfg(not(debug_assertions))]
fn prevent_debugger_attach() -> Result<(), ()> {
    unsafe {
        // PT_DENY_ATTACH는 후속 디버거 연결을 차단합니다. 현재 디버깅 중인 경우 시스템이 프로세스를 직접 종료합니다.
        if libc::ptrace(libc::PT_DENY_ATTACH, 0, std::ptr::null_mut(), 0) == -1 {
            return Err(());
        }
        Ok(())
    }
}
