mod browser;
mod debug_log;
mod ghostty;
mod runtime;

use browser::{
    browser_create_block, browser_destroy_block, browser_navigate_block, browser_reload_block,
    browser_update_block, BrowserManager,
};
use debug_log::{canvas_debug_log, debug_log, install_panic_hook};
use ghostty::{
    canvas_set_pending_shortcut_mode, ghostty_create_block, ghostty_destroy_block,
    ghostty_input_key, ghostty_input_text, ghostty_set_block_focus, ghostty_status,
    ghostty_update_block, GhosttyManager,
};
use runtime::{
    workspace_get_runtime, workspace_list_runtimes, workspace_read_runtime_log,
    workspace_start_runtime, workspace_stop_runtime, WorkspaceRuntimeManager,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ghostty_manager = GhosttyManager::default();
    let ghostty_manager_for_setup = ghostty_manager.clone();
    let browser_manager = BrowserManager::default();
    let runtime_manager = WorkspaceRuntimeManager::default();

    tauri::Builder::default()
        .manage(ghostty_manager)
        .manage(browser_manager)
        .manage(runtime_manager)
        .invoke_handler(tauri::generate_handler![
            ghostty_status,
            canvas_debug_log,
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
            workspace_start_runtime,
            workspace_get_runtime,
            workspace_stop_runtime,
            workspace_read_runtime_log,
            workspace_list_runtimes,
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(move |app| {
            install_panic_hook();
            debug_log("app", "setup start");
            ghostty::register_app_handle(app.handle().clone());
            ghostty::register_manager(&ghostty_manager_for_setup);

            let window = app.get_webview_window("main").unwrap();
            debug_log("app", format!("main window ready label={}", window.label()));
            ghostty::register_main_canvas_window_label(window.label().to_string());
            #[cfg(target_os = "macos")]
            {
                debug_log("app", "register native shortcut monitor");
                ghostty::register_native_shortcut_monitor();
            }

            #[cfg(target_os = "macos")]
            window_vibrancy::apply_vibrancy(
                &window,
                window_vibrancy::NSVisualEffectMaterial::UltraDark,
                None,
                None,
            )
            .expect("failed to apply vibrancy");

            #[cfg(target_os = "windows")]
            window_vibrancy::apply_blur(&window, Some((10, 10, 10, 200)))
                .expect("failed to apply blur");

            debug_log("app", "setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
