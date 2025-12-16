use windows::{
    Win32::System::{
        Diagnostics::Debug::{CheckRemoteDebuggerPresent, IsDebuggerPresent},
        Threading::GetCurrentProcess,
    },
    core::BOOL,
};

/// Windows 런타임 보호: 민감한 환경 변수 정리 + 디버거 감지
pub fn apply_runtime_guards() {
    sanitize_sensitive_env();
    enforce_debugger_policy();
}

fn sanitize_sensitive_env() {
    const BLOCKED_VARS: [&str; 4] = [
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
        "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER",
        "WEBVIEW2_USER_DATA_FOLDER",
        "WEBVIEW2_WAIT_FOR_SCRIPT_DEBUGGER",
    ];

    for key in BLOCKED_VARS {
        unsafe { std::env::remove_var(key) };
    }
}

fn enforce_debugger_policy() {
    if debugger_attached() {
        eprintln!("[HuLa] 디버거 또는 원격 디버깅 세션이 감지되었습니다. 보안상의 이유로 시작을 종료합니다.");

        #[cfg(not(debug_assertions))]
        {
            std::process::exit(0);
        }
    }
}

fn debugger_attached() -> bool {
    unsafe {
        if IsDebuggerPresent().as_bool() {
            return true;
        }

        let mut remote = BOOL(0);
        if CheckRemoteDebuggerPresent(GetCurrentProcess(), &mut remote).is_ok() {
            return remote.as_bool();
        }

        false
    }
}
