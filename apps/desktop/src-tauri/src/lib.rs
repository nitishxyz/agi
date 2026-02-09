mod commands;

use commands::server::ServerState;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder};
#[cfg(target_os = "linux")]
use tauri::Manager;

#[cfg(unix)]
use std::process::Command;

#[cfg(unix)]
fn kill_orphan_servers() {
    for port in (19000..19100).step_by(2) {
        if let Ok(output) = Command::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output()
        {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid in pids.lines() {
                if let Ok(pid_num) = pid.trim().parse::<i32>() {
                    eprintln!("[otto] Killing orphan process {} on port {}", pid_num, port);
                    let _ = Command::new("kill").arg("-9").arg(pid.trim()).output();
                }
            }
        }
    }
}

#[cfg(not(unix))]
fn kill_orphan_servers() {}

pub struct InitialProjectState {
    pub path: Mutex<Option<String>>,
}

fn parse_project_arg() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    for i in 0..args.len() {
        if args[i] == "--project" {
            if let Some(path) = args.get(i + 1) {
                let p = std::path::Path::new(path);
                if p.exists() && p.is_dir() {
                    return Some(path.clone());
                }
            }
        }
    }
    None
}

#[tauri::command]
fn get_initial_project(state: tauri::State<'_, InitialProjectState>) -> Option<String> {
    state.path.lock().unwrap().take()
}

#[tauri::command]
fn get_platform() -> String {
    std::env::consts::OS.to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    eprintln!("[otto] Cleaning up orphan servers on startup...");
    kill_orphan_servers();

    let initial_project = parse_project_arg();
    if let Some(ref p) = initial_project {
        eprintln!("[otto] CLI requested project: {}", p);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(ServerState::default())
        .manage(commands::updater::PendingUpdate(Mutex::new(None)))
        .manage(commands::updater::ReadyUpdate(Mutex::new(None)))
        .manage(InitialProjectState {
            path: Mutex::new(initial_project),
        })
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

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

            #[cfg(target_os = "linux")]
            {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_decorations(false);
                }
            }

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
            commands::project::open_project_dialog,
            commands::project::get_recent_projects,
            commands::project::save_recent_project,
            commands::project::remove_recent_project,
            commands::project::toggle_project_pinned,
            commands::server::start_server,
            commands::server::stop_server,
            commands::server::stop_all_servers,
            commands::server::list_servers,
            commands::github::github_save_token,
            commands::github::github_get_token,
            commands::github::github_logout,
            commands::github::github_get_user,
            commands::github::github_list_repos,
            commands::git::git_clone,
            commands::git::git_status,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_is_repo,
            commands::window::create_new_window,
            get_initial_project,
            get_platform,
            commands::onboarding::get_onboarding_status,
            commands::onboarding::generate_wallet,
            commands::onboarding::add_provider,
            commands::onboarding::remove_provider,
            commands::onboarding::set_defaults,
            commands::onboarding::complete_onboarding,
            commands::onboarding::get_home_directory,
            commands::updater::check_for_update,
            commands::updater::download_update,
            commands::updater::apply_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
