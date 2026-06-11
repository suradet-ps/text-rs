mod commands;
mod state;

use state::recent::RecentFilesState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(RecentFilesState(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            commands::file::open_file,
            commands::file::read_file,
            commands::file::save_file,
            commands::file::save_file_as,
            commands::file::add_recent_file,
            commands::file::get_recent_files,
            commands::file::remove_recent_file,
            commands::window::set_window_title,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                if let Some(window) = app_handle.get_webview_window("main") {
                    use tauri::Emitter;
                    let paths: Vec<String> = urls
                        .iter()
                        .filter_map(|u| u.to_file_path().ok().and_then(|p| p.to_str().map(String::from)))
                        .collect();
                    if !paths.is_empty() {
                        window.emit("file-opened", paths).unwrap();
                    }
                }
            }
        });
}
