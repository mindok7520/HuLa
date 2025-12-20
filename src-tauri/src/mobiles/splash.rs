#[cfg(target_os = "ios")]
mod platform {
    unsafe extern "C" {
        fn hula_show_splashscreen();
        fn hula_hide_splashscreen();
    }

    pub fn show() {
        unsafe { hula_show_splashscreen() };
    }

    pub fn hide() {
        unsafe { hula_hide_splashscreen() };
    }
}

#[cfg(target_os = "android")]
mod platform {
    use jni::{JavaVM, objects::JObject};

    fn invoke(method: &str) -> Result<(), jni::errors::Error> {
        let ctx = ndk_context::android_context();
        let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }?;
        let mut env = vm.attach_current_thread()?;
        let activity = unsafe { JObject::from_raw(ctx.context() as jni::sys::jobject) };

        // 정적 메서드를 사용하지 않고 Activity 인스턴스의 메서드를 직접 호출합니다.
        let result = env.call_method(&activity, method, "()V", &[]);

        let _ = activity.into_raw();

        result.map(|_| ()).map_err(|err| {
            if env.exception_check().unwrap_or(false) {
                let _ = env.exception_describe();
                let _ = env.exception_clear();
            }
            err
        })
    }

    pub fn show() {
        if let Err(err) = invoke("show") {
            tracing::error!("[Splashscreen] failed to show on Android: {}", err);
        }
    }

    pub fn hide() {
        if let Err(err) = invoke("hide") {
            tracing::error!("[Splashscreen] failed to hide on Android: {}", err);
        }
    }
}

#[cfg(not(any(target_os = "ios", target_os = "android")))]
mod platform {
    pub fn show() {}
    pub fn hide() {}
}

pub fn show() {
    platform::show();
}

pub fn hide() {
    platform::hide();
}

/// Tauri 명령: 스플래시 화면 숨기기 (프런트엔드에서 호출됨)
#[tauri::command]
pub fn hide_splash_screen() -> Result<(), String> {
    tracing::info!("hide_splash_screen called from frontend");
    hide();
    Ok(())
}
