mod commands;

use commands::server::ServerState;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use std::process::Command;

fn kill_orphan_servers() {
    // Kill any existing agi processes on our port range (macOS/Linux)
    #[cfg(unix)]
    {
        for port in (19000..19100).step_by(2) {
            // Try to find and kill process on this port
            if let Ok(output) = Command::new("lsof")
                .args(["-ti", &format!(":{}", port)])
                .output()
            {
                let pids = String::from_utf8_lossy(&output.stdout);
                for pid in pids.lines() {
                    if let Ok(pid_num) = pid.trim().parse::<i32>() {
                        eprintln!("[AGI] Killing orphan process {} on port {}", pid_num, port);
                        let _ = Command::new("kill").arg("-9").arg(pid.trim()).output();
                    }
                }
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Clean up any orphan servers from previous sessions
    eprintln!("[AGI] Cleaning up orphan servers on startup...");
    kill_orphan_servers();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(ServerState::default())
        .setup(|app| {
            let new_window = MenuItemBuilder::new("New Window")
                .id("new_window")
                .accelerator("CmdOrCtrl+Shift+N")
                .build(app)?;

            let file_menu = SubmenuBuilder::new(app, "File")
                .item(&new_window)
                .separator()
                .close_window()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .fullscreen()
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .build()?;

            let menu = MenuBuilder::new(app)
                .item(&file_menu)
                .item(&edit_menu)
                .item(&view_menu)
                .item(&window_menu)
                .build()?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "new_window" {
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = commands::window::create_new_window(handle).await;
                });
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Project commands
            commands::project::open_project_dialog,
            commands::project::get_recent_projects,
            commands::project::save_recent_project,
            commands::project::remove_recent_project,
            commands::project::toggle_project_pinned,
            // Server commands
            commands::server::start_server,
            commands::server::stop_server,
            commands::server::stop_all_servers,
            commands::server::list_servers,
            // GitHub commands
            commands::github::github_save_token,
            commands::github::github_get_token,
            commands::github::github_logout,
            commands::github::github_get_user,
            commands::github::github_list_repos,
            // Git commands
            commands::git::git_clone,
            commands::git::git_status,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_is_repo,
            // Window commands
            commands::window::create_new_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
