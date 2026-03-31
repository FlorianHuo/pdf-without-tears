use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .setup(|app| {
            // Set the window title on startup
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_title("PDF Without Tears");
            }

            // Create app data subdirectories for library storage
            let app_data = app.path().app_data_dir().expect("failed to get app data dir");
            let _ = std::fs::create_dir_all(app_data.join("thumbnails"));
            let _ = std::fs::create_dir_all(app_data.join("library"));

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
