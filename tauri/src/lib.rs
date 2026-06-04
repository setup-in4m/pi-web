use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Get the main window
            let window = app.get_webview_window("main").unwrap();
            
            // Open DevTools in dev mode
            #[cfg(debug_assertions)]
            window.open_devtools();
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running pi-web");
}
