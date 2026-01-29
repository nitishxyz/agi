mod commands;

use commands::server::ServerState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(ServerState::default())
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
