mod browser;
mod ghostty;

use browser::{
    browser_create_block, browser_destroy_block, browser_navigate_block, browser_reload_block,
    browser_update_block, BrowserManager,
};
use ghostty::{
    canvas_set_pending_shortcut_mode, ghostty_create_block, ghostty_destroy_block,
    ghostty_input_key, ghostty_input_text, ghostty_set_block_focus, ghostty_status,
    ghostty_update_block, GhosttyManager,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ghostty_manager = GhosttyManager::default();
    let ghostty_manager_for_setup = ghostty_manager.clone();
    let browser_manager = BrowserManager::default();

    tauri::Builder::default()
        .manage(ghostty_manager)
        .manage(browser_manager)
        .invoke_handler(tauri::generate_handler![
            ghostty_status,
            canvas_set_pending_shortcut_mode,
            ghostty_create_block,
            ghostty_update_block,
            ghostty_input_text,
            ghostty_input_key,
            ghostty_set_block_focus,
            ghostty_destroy_block,
            browser_create_block,
            browser_update_block,
            browser_navigate_block,
            browser_reload_block,
            browser_destroy_block,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(move |app| {
            ghostty::register_app_handle(app.handle().clone());
            ghostty::register_manager(&ghostty_manager_for_setup);

            let window = app.get_webview_window("main").unwrap();
            ghostty::register_main_canvas_window_label(window.label().to_string());
            #[cfg(target_os = "macos")]
            ghostty::register_native_shortcut_monitor();

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
