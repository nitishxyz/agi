mod browser;
mod cleanup;
mod debug_log;
mod ghostty;
mod ghostty_vt;
mod native_terminal;
mod runtime;
mod workspace_file;

use browser::{
    browser_create_block, browser_destroy_block, browser_navigate_block, browser_reload_block,
    browser_update_block, BrowserManager,
};
use cleanup::AppCleanupService;
use debug_log::{canvas_debug_log, debug_log, install_panic_hook};
use ghostty::{
    canvas_set_pending_shortcut_mode, ghostty_create_block, ghostty_destroy_block,
    ghostty_input_key, ghostty_input_text, ghostty_set_block_focus, ghostty_status,
    ghostty_update_block, GhosttyManager,
};
use ghostty_vt::{
    ghostty_vt_create_session, ghostty_vt_destroy_session, ghostty_vt_input_key,
    ghostty_vt_resize_session, ghostty_vt_scroll_viewport, ghostty_vt_send_text,
    ghostty_vt_snapshot_session, ghostty_vt_status, GhosttyVtManager,
};
use native_terminal::{
    native_terminal_create_block, native_terminal_destroy_block, native_terminal_status,
    native_terminal_update_block, NativeTerminalManager,
};
use runtime::{
    workspace_get_runtime, workspace_list_runtimes, workspace_read_runtime_log,
    workspace_start_runtime, workspace_stop_all_runtimes, workspace_stop_runtime,
    WorkspaceRuntimeManager,
};
use tauri::Manager;
use workspace_file::{workspace_file_exists, workspace_file_read, workspace_file_write};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let ghostty_manager = GhosttyManager::default();
    let ghostty_manager_for_setup = ghostty_manager.clone();
    let browser_manager = BrowserManager::default();
    let ghostty_vt_manager = GhosttyVtManager::default();
    let ghostty_vt_manager_for_setup = ghostty_vt_manager.clone();
    let native_terminal_manager = NativeTerminalManager::default();
    let runtime_manager = WorkspaceRuntimeManager::default();
    let cleanup_service = AppCleanupService::new(
        ghostty_manager.clone(),
        ghostty_vt_manager.clone(),
        native_terminal_manager.clone(),
        runtime_manager.clone(),
    );
    let cleanup_service_for_events = cleanup_service.clone();

    let app = tauri::Builder::default()
        .manage(ghostty_manager)
        .manage(browser_manager)
        .manage(ghostty_vt_manager)
        .manage(native_terminal_manager)
        .manage(runtime_manager)
        .invoke_handler(tauri::generate_handler![
            ghostty_status,
            ghostty_vt_status,
            native_terminal_status,
            canvas_debug_log,
            canvas_set_pending_shortcut_mode,
            ghostty_create_block,
            ghostty_update_block,
            ghostty_input_text,
            ghostty_input_key,
            ghostty_set_block_focus,
            ghostty_destroy_block,
            ghostty_vt_create_session,
            ghostty_vt_resize_session,
            ghostty_vt_send_text,
            ghostty_vt_input_key,
            ghostty_vt_scroll_viewport,
            ghostty_vt_snapshot_session,
            ghostty_vt_destroy_session,
            native_terminal_create_block,
            native_terminal_update_block,
            native_terminal_destroy_block,
            browser_create_block,
            browser_update_block,
            browser_navigate_block,
            browser_reload_block,
            browser_destroy_block,
            workspace_start_runtime,
            workspace_get_runtime,
            workspace_stop_runtime,
            workspace_stop_all_runtimes,
            workspace_read_runtime_log,
            workspace_list_runtimes,
            workspace_file_exists,
            workspace_file_read,
            workspace_file_write,
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
            ghostty_vt::register_manager(&ghostty_vt_manager_for_setup);

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
                window_vibrancy::NSVisualEffectMaterial::HudWindow,
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |app_handle, event| match event {
        tauri::RunEvent::ExitRequested { .. } => {
            debug_log("app", "exit requested — cleaning up block processes");
            cleanup_service_for_events.cleanup(app_handle, "exit-requested");
        }
        tauri::RunEvent::Exit => {
            debug_log("app", "event loop exit — cleaning up block processes");
            cleanup_service_for_events.cleanup(app_handle, "exit");
        }
        tauri::RunEvent::WindowEvent { label, event, .. } => {
            if label != "main" {
                return;
            }

            match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    debug_log("app", "main window close requested — cleaning up block processes");
                    cleanup_service_for_events.cleanup(app_handle, "main-window-close-requested");
                }
                tauri::WindowEvent::Destroyed => {
                    debug_log("app", "main window destroyed — cleaning up block processes");
                    cleanup_service_for_events.cleanup(app_handle, "main-window-destroyed");
                }
                _ => {}
            }
        }
        _ => {}
    });
}
