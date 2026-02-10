use std::net::TcpListener;

#[tauri::command]
pub fn find_available_port(tracked_ports: Vec<u16>) -> u16 {
    let base = 29000u16;

    for offset in 0..50u16 {
        let port = base + (offset * 2);
        if port > 60000 {
            break;
        }

        if tracked_ports.contains(&port) {
            continue;
        }

        let api_available = TcpListener::bind(("127.0.0.1", port)).is_ok();
        let web_available = TcpListener::bind(("127.0.0.1", port + 1)).is_ok();

        if api_available && web_available {
            return port;
        }
    }

    29000
}
