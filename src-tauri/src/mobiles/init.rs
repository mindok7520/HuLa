use crate::common::init::{CustomInit, init_common_plugins};
use tauri::Runtime;

impl<R: Runtime> CustomInit for tauri::Builder<R> {
    // 플러그인 초기화
    fn init_plugin(self) -> Self {
        let builder = init_common_plugins(self);

        // 모바일 전용 플러그인
        #[cfg(mobile)]
        let builder = builder
            .plugin(tauri_plugin_safe_area_insets::init())
            .plugin(tauri_plugin_hula::init())
            .plugin(tauri_plugin_barcode_scanner::init());

        builder
    }
}
