mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::docker::docker_available,
            commands::docker::image_exists,
            commands::docker::image_pull,
            commands::docker::container_exists,
            commands::docker::container_running,
            commands::docker::container_inspect,
            commands::docker::container_create,
            commands::docker::container_start,
            commands::docker::container_stop,
            commands::docker::container_remove,
            commands::docker::container_logs,
            commands::docker::container_exec,
            commands::docker::container_restart_otto,
            commands::docker::container_update_otto,
            commands::crypto::generate_deploy_key,
            commands::crypto::encrypt_key,
            commands::crypto::decrypt_key,
            commands::crypto::verify_password,
            commands::crypto::public_key_from_encrypted,
            commands::crypto::list_ssh_keys,
            commands::crypto::get_host_git_config,
            commands::config::load_state,
            commands::config::save_state,
            commands::config::parse_team_config,
            commands::config::export_team_config,
            commands::config::save_otto_file,
            commands::ports::find_available_port,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
