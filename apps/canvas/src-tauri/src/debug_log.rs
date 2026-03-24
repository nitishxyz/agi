use std::{
    backtrace::Backtrace,
    fs::OpenOptions,
    io::Write,
    panic,
    sync::OnceLock,
    time::{SystemTime, UNIX_EPOCH},
};

pub const DEBUG_LOG_PATH: &str = "/tmp/otto-canvas-debug.log";

pub fn debug_log(component: &str, message: impl AsRef<str>) {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let line = format!("[{timestamp}] [{component}] {}\n", message.as_ref());
    eprint!("{line}");
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(DEBUG_LOG_PATH)
    {
        let _ = file.write_all(line.as_bytes());
    }
}

static PANIC_HOOK_INSTALLED: OnceLock<()> = OnceLock::new();

pub fn install_panic_hook() {
    if PANIC_HOOK_INSTALLED.get().is_some() {
        return;
    }

    panic::set_hook(Box::new(|panic_info| {
        let backtrace = Backtrace::force_capture();
        debug_log(
            "panic",
            format!("panic: {panic_info}\nbacktrace:\n{backtrace}"),
        );
    }));

    let _ = PANIC_HOOK_INSTALLED.set(());
}

#[tauri::command]
pub fn canvas_debug_log(component: String, message: String) {
    debug_log(&component, message);
}
