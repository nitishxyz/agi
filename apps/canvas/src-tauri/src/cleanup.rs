use crate::{
    debug_log::debug_log, ghostty::GhosttyManager, ghostty_vt::GhosttyVtManager,
    native_terminal::NativeTerminalManager, runtime::WorkspaceRuntimeManager,
};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tauri::{AppHandle, Wry};

#[derive(Clone)]
pub struct AppCleanupService {
    inner: Arc<AppCleanupState>,
}

struct AppCleanupState {
    started: AtomicBool,
    ghostty_manager: GhosttyManager,
    ghostty_vt_manager: GhosttyVtManager,
    native_terminal_manager: NativeTerminalManager,
    runtime_manager: WorkspaceRuntimeManager,
}

impl AppCleanupService {
    pub fn new(
        ghostty_manager: GhosttyManager,
        ghostty_vt_manager: GhosttyVtManager,
        native_terminal_manager: NativeTerminalManager,
        runtime_manager: WorkspaceRuntimeManager,
    ) -> Self {
        Self {
            inner: Arc::new(AppCleanupState {
                started: AtomicBool::new(false),
                ghostty_manager,
                ghostty_vt_manager,
                native_terminal_manager,
                runtime_manager,
            }),
        }
    }

    pub fn cleanup(&self, app_handle: &AppHandle<Wry>, reason: &str) {
        if self.inner.started.swap(true, Ordering::SeqCst) {
            debug_log("app", format!("cleanup already started reason={reason}"));
            return;
        }

        debug_log(
            "app",
            format!(
                "cleanup start reason={reason} native_blocks={} ghostty_blocks={} vt_sessions={} runtimes={}",
                self.inner.native_terminal_manager.block_count(),
                self.inner.ghostty_manager.block_count(),
                self.inner.ghostty_vt_manager.session_count(),
                self.inner.runtime_manager.runtime_count(),
            ),
        );

        if let Err(error) = self.inner.native_terminal_manager.destroy_all(app_handle) {
            debug_log("app", format!("native terminal cleanup failed: {error}"));
        }

        if let Err(error) = self.inner.ghostty_manager.destroy_all(app_handle) {
            debug_log("app", format!("ghostty cleanup failed: {error}"));
        }

        if let Err(error) = self.inner.ghostty_vt_manager.stop_all() {
            debug_log("app", format!("ghostty vt cleanup failed: {error}"));
        }

        self.inner.runtime_manager.stop_all();
        debug_log(
            "app",
            format!(
                "cleanup complete reason={reason} native_blocks={} ghostty_blocks={} vt_sessions={} runtimes={}",
                self.inner.native_terminal_manager.block_count(),
                self.inner.ghostty_manager.block_count(),
                self.inner.ghostty_vt_manager.session_count(),
                self.inner.runtime_manager.runtime_count(),
            ),
        );
    }
}
