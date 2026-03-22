mod ghostty;

use ghostty::{
    ghostty_create_block, ghostty_destroy_block, ghostty_input_key, ghostty_input_text,
    ghostty_status, ghostty_update_block, GhosttyManager,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ghostty_manager = GhosttyManager::default();
    let ghostty_manager_for_setup = ghostty_manager.clone();

    tauri::Builder::default()
        .manage(ghostty_manager)
        .invoke_handler(tauri::generate_handler![
            ghostty_status,
            ghostty_create_block,
            ghostty_update_block,
            ghostty_input_text,
            ghostty_input_key,
            ghostty_destroy_block,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(move |app| {
            ghostty::register_app_handle(app.handle().clone());
            ghostty::register_manager(&ghostty_manager_for_setup);

            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            window_vibrancy::apply_vibrancy(
                &window,
                window_vibrancy::NSVisualEffectMaterial::HudWindow,
                None,
                None,
            )
            .expect("failed to apply vibrancy");

            #[cfg(target_os = "windows")]
            window_vibrancy::apply_blur(&window, Some((18, 18, 18, 125)))
                .expect("failed to apply blur");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
