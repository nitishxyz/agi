use std::net::TcpListener;

#[tauri::command]
pub fn find_available_port(tracked_ports: Vec<u16>) -> u16 {
    let base = 29000u16;
    let step = 20u16;

    let mut reserved: Vec<std::ops::RangeInclusive<u16>> = Vec::new();
    for &tp in &tracked_ports {
        reserved.push(tp..=tp + step - 1);
    }

    for i in 0..50u16 {
        let port = base + (i * step);
        if port > 60000 {
            break;
        }

        let candidate_end = port + step - 1;
        let overlaps = reserved.iter().any(|r| {
            port <= *r.end() && candidate_end >= *r.start()
        });
        if overlaps {
            continue;
        }

        let api_available = TcpListener::bind(("127.0.0.1", port)).is_ok();
        let web_available = TcpListener::bind(("127.0.0.1", port + 1)).is_ok();

        let dev_start = port + 10;
        let dev_end = port + 19;
        let dev_available = (dev_start..=dev_end)
            .all(|p| TcpListener::bind(("127.0.0.1", p)).is_ok());

        if api_available && web_available && dev_available {
            return port;
        }
    }

    29000
}
