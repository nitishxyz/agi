use serde::Serialize;
use std::{
    collections::HashMap,
    ffi::{c_char, c_int, c_void, CString},
    sync::{mpsc, Arc, Mutex, OnceLock},
};
use tauri::{AppHandle, Emitter, Manager, WebviewWindow, Wry};

#[cfg(target_os = "macos")]
use objc2_foundation::MainThreadMarker;

#[derive(Clone, Default)]
pub struct GhosttyManager {
    inner: Arc<Mutex<GhosttyState>>,
}

#[derive(Default)]
struct GhosttyState {
    runtime: Option<GhosttyRuntime>,
}

struct GhosttyRuntime {
    app_path: String,
    _resources_dir: String,
    app: GhosttyApp,
    _config: GhosttyConfig,
    blocks: HashMap<String, GhosttyBlock>,
}

struct GhosttyBlock {
    surface: GhosttySurface,
    host_view: usize,
}

unsafe impl Send for GhosttyState {}
unsafe impl Send for GhosttyRuntime {}
unsafe impl Send for GhosttyBlock {}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhosttyStatus {
    pub available: bool,
    pub message: String,
    pub app_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GhosttyShortcutEvent {
    shortcut: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GhosttyCloseEvent {
    block_id: String,
    process_alive: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GhosttyFocusEvent {
    block_id: String,
}

static APP_HANDLE: OnceLock<AppHandle<Wry>> = OnceLock::new();
static GHOSTTY_MANAGER: OnceLock<Arc<Mutex<GhosttyState>>> = OnceLock::new();
static MAIN_WEBVIEW_WINDOW_LABEL: OnceLock<String> = OnceLock::new();
static PENDING_SHORTCUT_MODE: OnceLock<Mutex<bool>> = OnceLock::new();

pub fn register_app_handle(app_handle: AppHandle<Wry>) {
    let _ = APP_HANDLE.set(app_handle);
}

pub fn register_manager(manager: &GhosttyManager) {
    let _ = GHOSTTY_MANAGER.set(manager.inner.clone());
}

pub fn emit_block_focus_event(block_id: String) {
    if let Some(app_handle) = APP_HANDLE.get() {
        let _ = app_handle.emit("ghostty-focus-block", GhosttyFocusEvent { block_id });
    }
}

pub fn register_main_canvas_window_label(label: String) {
    let _ = MAIN_WEBVIEW_WINDOW_LABEL.set(label);
}

pub fn emit_native_shortcut(shortcut: &str) {
    #[cfg(target_os = "macos")]
    macos::emit_shortcut(shortcut);

    #[cfg(not(target_os = "macos"))]
    let _ = shortcut;
}

#[tauri::command]
pub fn canvas_set_pending_shortcut_mode(enabled: bool) {
    let mode = PENDING_SHORTCUT_MODE.get_or_init(|| Mutex::new(false));
    if let Ok(mut value) = mode.lock() {
        *value = enabled;
    }
}

#[cfg(target_os = "macos")]
pub fn register_native_shortcut_monitor() {
    macos::register_native_shortcut_monitor();
}

fn ghostty_debug_log(message: &str) {
    let _ = message;
}

#[tauri::command]
pub fn ghostty_status(manager: tauri::State<'_, GhosttyManager>) -> Result<GhosttyStatus, String> {
    #[cfg(target_os = "macos")]
    {
        let Some(app_handle) = APP_HANDLE.get() else {
            return Err("Canvas app handle is not ready yet".into());
        };
        let manager = manager.inner().clone();
        run_on_main_thread_sync(app_handle, move || manager.status())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = manager;
        Ok(GhosttyStatus {
            available: false,
            message: "Ghostty blocks are currently implemented for macOS only.".into(),
            app_path: None,
        })
    }
}

#[cfg(target_os = "macos")]
pub(crate) fn main_canvas_window(app_handle: &AppHandle<Wry>) -> Result<WebviewWindow, String> {
    if let Some(label) = MAIN_WEBVIEW_WINDOW_LABEL.get() {
        if let Some(window) = app_handle.get_webview_window(label) {
            return Ok(window);
        }
    }

    if let Some(window) = app_handle.webview_windows().into_values().next() {
        return Ok(window);
    }

    Err("Main canvas window was not found".to_string())
}

#[tauri::command]
pub fn ghostty_create_block(
    app_handle: AppHandle<Wry>,
    manager: tauri::State<'_, GhosttyManager>,
    block_id: String,
    cwd: Option<String>,
    command: Option<String>,
) -> Result<(), String> {
    ghostty_debug_log(&format!("ghostty_create_block start block_id={block_id}"));
    #[cfg(target_os = "macos")]
    {
        let manager = manager.inner().inner.clone();
        let window = main_canvas_window(&app_handle)?;
        let log_block_id = block_id.clone();
        let result = run_on_main_thread_sync(&app_handle, move || unsafe {
            create_block_inner(
                &window,
                &manager,
                &block_id,
                cwd.as_deref(),
                command.as_deref(),
            )
        });
        ghostty_debug_log(&format!(
            "ghostty_create_block finish block_id={log_block_id} ok={}",
            result.is_ok()
        ));
        result
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_handle, manager, block_id, cwd, command);
        Err("Ghostty blocks are currently implemented for macOS only.".into())
    }
}

#[tauri::command]
pub fn ghostty_update_block(
    app_handle: AppHandle<Wry>,
    manager: tauri::State<'_, GhosttyManager>,
    block_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    viewport_height: f64,
    scale_factor: f64,
    focused: bool,
    hidden: Option<bool>,
) -> Result<(), String> {
    ghostty_debug_log(&format!(
        "ghostty_update_block start block_id={block_id} focused={focused} hidden={}",
        hidden.unwrap_or(false)
    ));
    #[cfg(target_os = "macos")]
    {
        let manager = manager.inner().inner.clone();
        let window = main_canvas_window(&app_handle)?;
        let hidden_flag = hidden.unwrap_or(false);
        let log_block_id = block_id.clone();
        let scheduled_block_id = block_id.clone();
        let app_handle = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            let _ = app_handle.run_on_main_thread(move || unsafe {
                let result = update_block_inner(
                    &window,
                    &manager,
                    &block_id,
                    x,
                    y,
                    width,
                    height,
                    viewport_height,
                    scale_factor,
                    focused,
                    hidden_flag,
                );
                ghostty_debug_log(&format!(
                    "ghostty_update_block inner_finish block_id={log_block_id} ok={}",
                    result.is_ok()
                ));
            });
        });
        ghostty_debug_log(&format!(
            "ghostty_update_block scheduled block_id={scheduled_block_id}"
        ));
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (
            app_handle,
            manager,
            block_id,
            x,
            y,
            width,
            height,
            viewport_height,
            scale_factor,
            focused,
            hidden,
        );
        Err("Ghostty blocks are currently implemented for macOS only.".into())
    }
}

#[tauri::command]
pub fn ghostty_input_text(
    app_handle: AppHandle<Wry>,
    manager: tauri::State<'_, GhosttyManager>,
    block_id: String,
    text: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let manager = manager.inner().inner.clone();
        run_on_main_thread_sync(&app_handle, move || unsafe {
            input_text_inner(&manager, &block_id, &text)
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_handle, manager, block_id, text);
        Err("Ghostty blocks are currently implemented for macOS only.".into())
    }
}

#[tauri::command]
pub fn ghostty_input_key(
    app_handle: AppHandle<Wry>,
    manager: tauri::State<'_, GhosttyManager>,
    block_id: String,
    keycode: u32,
    mods: i32,
    text: Option<String>,
    composing: Option<bool>,
    action: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let manager = manager.inner().inner.clone();
        run_on_main_thread_sync(&app_handle, move || unsafe {
            input_key_inner(
                &manager,
                &block_id,
                keycode,
                mods,
                text.as_deref(),
                composing.unwrap_or(false),
                action.as_deref().unwrap_or("press"),
            )
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (
            app_handle, manager, block_id, keycode, mods, text, composing, action,
        );
        Err("Ghostty blocks are currently implemented for macOS only.".into())
    }
}

#[tauri::command]
pub fn ghostty_set_block_focus(
    app_handle: AppHandle<Wry>,
    manager: tauri::State<'_, GhosttyManager>,
    block_id: String,
    focused: bool,
) -> Result<(), String> {
    ghostty_debug_log(&format!(
        "ghostty_set_block_focus start block_id={block_id} focused={focused}"
    ));
    #[cfg(target_os = "macos")]
    {
        let manager = manager.inner().inner.clone();
        let log_block_id = block_id.clone();
        app_handle
            .run_on_main_thread(move || unsafe {
                let _ = set_block_focus_inner(&manager, &block_id, focused);
            })
            .map_err(|error| error.to_string())?;
        ghostty_debug_log(&format!(
            "ghostty_set_block_focus finish block_id={log_block_id} focused={focused}"
        ));
        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_handle, manager, block_id, focused);
        Err("Ghostty blocks are currently implemented for macOS only.".into())
    }
}

#[tauri::command]
pub fn ghostty_destroy_block(
    app_handle: AppHandle<Wry>,
    manager: tauri::State<'_, GhosttyManager>,
    block_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let manager = manager.inner().inner.clone();
        run_on_main_thread_sync(&app_handle, move || unsafe {
            destroy_block_inner(&manager, &block_id)
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_handle, manager, block_id);
        Err("Ghostty blocks are currently implemented for macOS only.".into())
    }
}

impl GhosttyManager {
    pub fn block_count(&self) -> usize {
        self.inner
            .lock()
            .ok()
            .and_then(|state| state.runtime.as_ref().map(|runtime| runtime.blocks.len()))
            .unwrap_or(0)
    }

    #[cfg(target_os = "macos")]
    fn status(&self) -> Result<GhosttyStatus, String> {
        let _ = self;
        let app_path = crate::ghostty::macos::find_ghostty_app_path()?;
        let _ = crate::ghostty::macos::ghostty_resources_dir(&app_path)?;
        let _ = crate::ghostty::macos::ghostty_frameworks_dir(&app_path)?;
        Ok(GhosttyStatus {
            available: true,
            message: format!("Using local Ghostty app at {}", app_path.display()),
            app_path: Some(app_path.display().to_string()),
        })
    }

    pub fn destroy_all(&self, app_handle: &AppHandle<Wry>) -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            let block_ids = {
                let state = self
                    .inner
                    .lock()
                    .map_err(|_| "Failed to lock Ghostty manager state".to_string())?;
                state
                    .runtime
                    .as_ref()
                    .map(|runtime| runtime.blocks.keys().cloned().collect::<Vec<_>>())
                    .unwrap_or_default()
            };

            if block_ids.is_empty() {
                return Ok(());
            }

            let manager = self.inner.clone();
            let app_handle = app_handle.clone();
            return crate::ghostty::run_on_main_thread_sync(&app_handle, move || unsafe {
                for block_id in block_ids {
                    macos::destroy_block_inner(&manager, &block_id)?;
                }
                Ok(())
            });
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = app_handle;
            Ok(())
        }
    }
}

pub(crate) fn run_on_main_thread_sync<T: Send + 'static>(
    app_handle: &AppHandle<Wry>,
    task: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    #[cfg(target_os = "macos")]
    if MainThreadMarker::new().is_some() {
        return task();
    }

    let (tx, rx) = mpsc::sync_channel(1);
    app_handle
        .run_on_main_thread(move || {
            let _ = tx.send(task());
        })
        .map_err(|error| error.to_string())?;
    rx.recv()
        .map_err(|_| "Main-thread Ghostty task was cancelled".to_string())?
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use block2::RcBlock;
    use libloading::os::unix::{Library, RTLD_GLOBAL, RTLD_NOW};
    use objc2::rc::Retained;
    use objc2::{define_class, msg_send, MainThreadOnly};
    use objc2_app_kit::{
        NSEvent, NSEventMask, NSEventModifierFlags, NSPasteboard, NSPasteboardTypeString,
        NSResponder, NSView, NSWindowOrderingMode,
    };
    use objc2_foundation::{MainThreadMarker, NSObjectProtocol, NSPoint, NSRect, NSSize, NSString};
    use std::path::{Path, PathBuf};

    type GhosttyApp = *mut c_void;
    type GhosttyConfig = *mut c_void;
    type GhosttySurface = *mut c_void;

    #[allow(dead_code)]
    #[repr(C)]
    #[derive(Clone, Copy)]
    enum GhosttyPlatform {
        Invalid = 0,
        Macos = 1,
        Ios = 2,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct GhosttyPlatformMacos {
        nsview: *mut c_void,
    }

    #[repr(C)]
    union GhosttyPlatformUnion {
        macos: GhosttyPlatformMacos,
    }

    #[repr(C)]
    struct GhosttyEnvVar {
        key: *const c_char,
        value: *const c_char,
    }

    #[allow(dead_code)]
    #[repr(C)]
    #[derive(Clone, Copy)]
    enum GhosttySurfaceContext {
        Window = 0,
        Tab = 1,
        Split = 2,
    }

    #[allow(dead_code)]
    #[repr(C)]
    #[derive(Clone, Copy)]
    enum GhosttyInputAction {
        Release = 0,
        Press = 1,
        Repeat = 2,
    }

    #[allow(dead_code)]
    #[repr(C)]
    #[derive(Clone, Copy)]
    enum GhosttyMouseState {
        Release = 0,
        Press = 1,
    }

    #[allow(dead_code)]
    #[repr(C)]
    #[derive(Clone, Copy)]
    enum GhosttyMouseButton {
        Unknown = 0,
        Left = 1,
        Right = 2,
        Middle = 3,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct GhosttyInputKey {
        action: GhosttyInputAction,
        mods: i32,
        consumed_mods: i32,
        keycode: u32,
        text: *const c_char,
        unshifted_codepoint: u32,
        composing: bool,
    }

    #[allow(dead_code)]
    #[repr(C)]
    #[derive(Clone, Copy)]
    enum GhosttyClipboard {
        Standard = 0,
        Selection = 1,
    }

    #[allow(dead_code)]
    #[repr(C)]
    #[derive(Clone, Copy)]
    enum GhosttyClipboardRequest {
        Paste = 0,
        Osc52Read = 1,
        Osc52Write = 2,
    }

    #[allow(dead_code)]
    #[repr(C)]
    #[derive(Clone, Copy)]
    enum GhosttyTargetTag {
        App = 0,
        Surface = 1,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    union GhosttyTargetUnion {
        surface: GhosttySurface,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct GhosttyTarget {
        tag: GhosttyTargetTag,
        target: GhosttyTargetUnion,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct GhosttyAction {
        tag: i32,
        payload: [u8; 16],
    }

    #[repr(C)]
    struct GhosttyRuntimeConfig {
        userdata: *mut c_void,
        supports_selection_clipboard: bool,
        wakeup_cb: Option<unsafe extern "C" fn(*mut c_void)>,
        action_cb: Option<unsafe extern "C" fn(GhosttyApp, GhosttyTarget, GhosttyAction) -> bool>,
        read_clipboard_cb: Option<unsafe extern "C" fn(*mut c_void, GhosttyClipboard, *mut c_void)>,
        confirm_read_clipboard_cb: Option<
            unsafe extern "C" fn(*mut c_void, *const c_char, *mut c_void, GhosttyClipboardRequest),
        >,
        write_clipboard_cb:
            Option<unsafe extern "C" fn(*mut c_void, *const c_char, GhosttyClipboard, bool)>,
        close_surface_cb: Option<unsafe extern "C" fn(*mut c_void, bool)>,
    }

    #[repr(C)]
    struct GhosttySurfaceConfig {
        platform_tag: GhosttyPlatform,
        platform: GhosttyPlatformUnion,
        userdata: *mut c_void,
        scale_factor: f64,
        font_size: f32,
        working_directory: *const c_char,
        command: *const c_char,
        env_vars: *mut GhosttyEnvVar,
        env_var_count: usize,
        initial_input: *const c_char,
        wait_after_command: bool,
        context: GhosttySurfaceContext,
    }

    struct GhosttyApi {
        init: unsafe extern "C" fn(usize, *mut *mut c_char) -> c_int,
        config_new: unsafe extern "C" fn() -> GhosttyConfig,
        config_load_default_files: unsafe extern "C" fn(GhosttyConfig),
        config_load_recursive_files: unsafe extern "C" fn(GhosttyConfig),
        config_finalize: unsafe extern "C" fn(GhosttyConfig),
        app_new: unsafe extern "C" fn(*const GhosttyRuntimeConfig, GhosttyConfig) -> GhosttyApp,
        app_tick: unsafe extern "C" fn(GhosttyApp),
        surface_config_new: unsafe extern "C" fn() -> GhosttySurfaceConfig,
        surface_new: unsafe extern "C" fn(GhosttyApp, *mut GhosttySurfaceConfig) -> GhosttySurface,
        surface_free: unsafe extern "C" fn(GhosttySurface),
        surface_set_content_scale: unsafe extern "C" fn(GhosttySurface, f64, f64),
        surface_set_size: unsafe extern "C" fn(GhosttySurface, u32, u32),
        surface_set_focus: unsafe extern "C" fn(GhosttySurface, bool),
        surface_text: unsafe extern "C" fn(GhosttySurface, *const c_char, usize),
        surface_key: unsafe extern "C" fn(GhosttySurface, GhosttyInputKey) -> bool,
        surface_mouse_button: unsafe extern "C" fn(
            GhosttySurface,
            GhosttyMouseState,
            GhosttyMouseButton,
            i32,
        ) -> bool,
        surface_mouse_pos: unsafe extern "C" fn(GhosttySurface, f64, f64, i32),
        surface_mouse_scroll: unsafe extern "C" fn(GhosttySurface, f64, f64, i32),
        surface_binding_action: unsafe extern "C" fn(GhosttySurface, *const c_char, usize) -> bool,
    }

    static GHOSTTY_API: OnceLock<GhosttyApi> = OnceLock::new();

    define_class!(
        #[unsafe(super = NSView)]
        #[thread_kind = MainThreadOnly]
        struct GhosttyHostView;

        unsafe impl NSObjectProtocol for GhosttyHostView {}

        impl GhosttyHostView {
            #[unsafe(method(acceptsFirstResponder))]
            fn accepts_first_responder(&self) -> bool {
                true
            }

            #[unsafe(method(acceptsFirstMouse:))]
            fn accepts_first_mouse(&self, _event: Option<&NSEvent>) -> bool {
                true
            }

            #[unsafe(method(mouseDown:))]
            fn mouse_down(&self, event: &NSEvent) {
                unsafe { emit_focus_request(self) };
                if let Some(window) = self.window() {
                    let _ = window.makeFirstResponder(Some(self));
                }
                unsafe { handle_host_view_mouse_button(self, event, GhosttyMouseState::Press, GhosttyMouseButton::Left) };
            }

            #[unsafe(method(mouseUp:))]
            fn mouse_up(&self, event: &NSEvent) {
                unsafe { handle_host_view_mouse_button(self, event, GhosttyMouseState::Release, GhosttyMouseButton::Left) };
            }

            #[unsafe(method(mouseDragged:))]
            fn mouse_dragged(&self, event: &NSEvent) {
                unsafe { handle_host_view_mouse_move(self, event) };
            }

            #[unsafe(method(scrollWheel:))]
            fn scroll_wheel(&self, event: &NSEvent) {
                unsafe { handle_host_view_mouse_scroll(self, event) };
            }

            #[unsafe(method(copy:))]
            fn copy(&self, _sender: Option<&NSResponder>) {
                unsafe {
                    let _ = perform_host_view_action(self, "copy_to_clipboard");
                }
            }

            #[unsafe(method(paste:))]
            fn paste(&self, _sender: Option<&NSResponder>) {
                unsafe {
                    let _ = paste_host_view_from_clipboard(self);
                }
            }

            #[unsafe(method(selectAll:))]
            fn select_all(&self, _sender: Option<&NSResponder>) {
                unsafe {
                    let _ = perform_host_view_action(self, "select_all");
                }
            }

            #[unsafe(method(becomeFirstResponder))]
            fn become_first_responder(&self) -> bool {
                let result: bool = unsafe { msg_send![super(self), becomeFirstResponder] };
                if result {
                    unsafe { emit_focus_request(self) };
                    unsafe { focus_host_view_surface(self, true) };
                }
                result
            }

            #[unsafe(method(resignFirstResponder))]
            fn resign_first_responder(&self) -> bool {
                let result: bool = unsafe { msg_send![super(self), resignFirstResponder] };
                if result {
                    unsafe { focus_host_view_surface(self, false) };
                }
                result
            }

            #[unsafe(method(keyDown:))]
            fn key_down(&self, event: &NSEvent) {
                unsafe { handle_host_view_key_event(self, event, GhosttyInputAction::Press) };
            }

            #[unsafe(method(keyUp:))]
            fn key_up(&self, event: &NSEvent) {
                unsafe { handle_host_view_key_event(self, event, GhosttyInputAction::Release) };
            }

            #[unsafe(method(performKeyEquivalent:))]
            fn perform_key_equivalent(&self, event: &NSEvent) -> bool {
                unsafe { perform_host_view_key_equivalent(self, event) }.into()
            }
        }
    );

    impl GhosttyHostView {
        fn new(mtm: MainThreadMarker, frame: NSRect) -> Retained<Self> {
            unsafe { msg_send![Self::alloc(mtm), initWithFrame: frame] }
        }
    }

    fn ghostty_mods_from_event(event: &NSEvent) -> i32 {
        let flags = event.modifierFlags();
        let mut mods = 0;
        if flags.contains(NSEventModifierFlags::Shift) {
            mods |= 1 << 0;
        }
        if flags.contains(NSEventModifierFlags::Control) {
            mods |= 1 << 1;
        }
        if flags.contains(NSEventModifierFlags::Option) {
            mods |= 1 << 2;
        }
        if flags.contains(NSEventModifierFlags::Command) {
            mods |= 1 << 3;
        }
        mods
    }

    fn scale_factor_for_view(view: &NSView) -> f64 {
        view.window()
            .map(|window| window.backingScaleFactor())
            .unwrap_or(2.0)
    }

    fn view_point_for_event(view: &NSView, event: &NSEvent) -> NSPoint {
        view.convertPoint_fromView(event.locationInWindow(), None)
    }

    fn consumed_mods_from_event(event: &NSEvent) -> i32 {
        let flags = event.modifierFlags();
        let mut mods = 0;
        if flags.contains(NSEventModifierFlags::Shift) {
            mods |= 1 << 0;
        }
        if flags.contains(NSEventModifierFlags::Option) {
            mods |= 1 << 2;
        }
        mods
    }

    fn key_event_action(action: GhosttyInputAction, is_repeat: bool) -> GhosttyInputAction {
        if matches!(action, GhosttyInputAction::Press) && is_repeat {
            GhosttyInputAction::Repeat
        } else {
            action
        }
    }

    fn unshifted_codepoint_from_event(event: &NSEvent) -> u32 {
        if let Some(chars) = event
            .charactersIgnoringModifiers()
            .or_else(|| event.characters())
        {
            let raw = chars.UTF8String();
            if !raw.is_null() {
                if let Some(ch) = unsafe { std::ffi::CStr::from_ptr(raw) }
                    .to_string_lossy()
                    .chars()
                    .next()
                {
                    return ch as u32;
                }
            }
        }
        0
    }

    fn string_from_nsstring(value: &objc2_foundation::NSString) -> Option<String> {
        let raw = value.UTF8String();
        if raw.is_null() {
            return None;
        }
        Some(
            unsafe { std::ffi::CStr::from_ptr(raw) }
                .to_string_lossy()
                .to_string(),
        )
    }

    fn shortcut_for_event(event: &NSEvent) -> Option<(&'static str, bool)> {
        let flags = event
            .modifierFlags()
            .intersection(NSEventModifierFlags::DeviceIndependentFlagsMask);
        let key = event
            .charactersIgnoringModifiers()
            .as_deref()
            .and_then(string_from_nsstring)
            .map(|value| value.to_lowercase());
        let key_code = event.keyCode();
        let digit_shortcut = match key_code {
            18 => Some("1"),
            19 => Some("2"),
            20 => Some("3"),
            21 => Some("4"),
            23 => Some("5"),
            22 => Some("6"),
            26 => Some("7"),
            28 => Some("8"),
            25 => Some("9"),
            _ => key.as_deref().filter(|value| {
                matches!(*value, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
            }),
        };

        if flags.contains(NSEventModifierFlags::Command)
            && !flags.contains(NSEventModifierFlags::Option)
        {
            if let Some(digit) = digit_shortcut {
                return Some((
                    match digit {
                        "1" => "mod+1",
                        "2" => "mod+2",
                        "3" => "mod+3",
                        "4" => "mod+4",
                        "5" => "mod+5",
                        "6" => "mod+6",
                        "7" => "mod+7",
                        "8" => "mod+8",
                        "9" => "mod+9",
                        _ => unreachable!(),
                    },
                    true,
                ));
            }
            return match key.as_deref() {
                Some("n") => Some(("mod+n", true)),
                Some("t") => Some(("mod+t", true)),
                Some("d") if flags.contains(NSEventModifierFlags::Shift) => {
                    Some(("mod+shift+d", true))
                }
                Some("d") => Some(("mod+d", true)),
                Some("w") => Some(("mod+w", true)),
                Some("[") => Some(("mod+[", true)),
                Some("]") => Some(("mod+]", true)),
                Some("h") => Some(("meta+h", true)),
                Some("j") => Some(("meta+j", true)),
                Some("k") => Some(("meta+k", true)),
                Some("l") => Some(("meta+l", true)),
                Some("b") if flags.contains(NSEventModifierFlags::Shift) => {
                    Some(("mod+shift+b", true))
                }
                _ => None,
            };
        }

        if flags.contains(NSEventModifierFlags::Control)
            && !flags.contains(NSEventModifierFlags::Command)
            && !flags.contains(NSEventModifierFlags::Option)
        {
            if flags.contains(NSEventModifierFlags::Shift) {
                if let Some(digit) = digit_shortcut {
                    return Some((
                        match digit {
                            "1" => "ctrl+shift+1",
                            "2" => "ctrl+shift+2",
                            "3" => "ctrl+shift+3",
                            "4" => "ctrl+shift+4",
                            "5" => "ctrl+shift+5",
                            "6" => "ctrl+shift+6",
                            "7" => "ctrl+shift+7",
                            "8" => "ctrl+shift+8",
                            "9" => "ctrl+shift+9",
                            _ => unreachable!(),
                        },
                        true,
                    ));
                }
            }
            return None;
        }

        if !flags.contains(NSEventModifierFlags::Command)
            && !flags.contains(NSEventModifierFlags::Control)
            && !flags.contains(NSEventModifierFlags::Option)
        {
            let pending_mode = PENDING_SHORTCUT_MODE
                .get()
                .and_then(|value| value.lock().ok().map(|enabled| *enabled))
                .unwrap_or(false);
            return match digit_shortcut {
                Some("1") if pending_mode => Some(("plain+1", true)),
                Some("2") if pending_mode => Some(("plain+2", true)),
                Some("3") if pending_mode => Some(("plain+3", true)),
                Some("4") if pending_mode => Some(("plain+4", true)),
                Some("5") if pending_mode => Some(("plain+5", true)),
                Some("6") if pending_mode => Some(("plain+6", true)),
                Some("7") if pending_mode => Some(("plain+7", true)),
                Some("8") if pending_mode => Some(("plain+8", true)),
                Some("9") if pending_mode => Some(("plain+9", true)),
                _ => {
                    if pending_mode && event.keyCode() == 53 {
                        Some(("escape", true))
                    } else {
                        None
                    }
                }
            };
        }

        None
    }

    pub(super) fn emit_shortcut(shortcut: &str) {
        ghostty_debug_log(&format!("emit_shortcut shortcut={shortcut}"));
        if let Some(app_handle) = APP_HANDLE.get() {
            let _ = app_handle.emit(
                "ghostty-native-shortcut",
                GhosttyShortcutEvent {
                    shortcut: shortcut.to_string(),
                },
            );
        }
    }

    static SHORTCUT_MONITOR_INSTALLED: OnceLock<()> = OnceLock::new();

    pub(super) fn register_native_shortcut_monitor() {
        if SHORTCUT_MONITOR_INSTALLED.get().is_some() {
            ghostty_debug_log("register_native_shortcut_monitor skipped already_installed");
            return;
        }
        ghostty_debug_log("register_native_shortcut_monitor install");

        let block = RcBlock::new(|event_ptr: std::ptr::NonNull<NSEvent>| -> *mut NSEvent {
            let event = unsafe { event_ptr.as_ref() };
            if let Some((shortcut, swallow)) = shortcut_for_event(event) {
                emit_shortcut(shortcut);
                if swallow {
                    return std::ptr::null_mut();
                }
            }
            event_ptr.as_ptr()
        });
        let monitor = unsafe {
            NSEvent::addLocalMonitorForEventsMatchingMask_handler(NSEventMask::KeyDown, &block)
        };
        if monitor.is_some() {
            ghostty_debug_log("register_native_shortcut_monitor installed");
            let _ = SHORTCUT_MONITOR_INSTALLED.set(());
            let _ = Box::leak(Box::new(block));
            let _ = Box::leak(Box::new(monitor));
        } else {
            ghostty_debug_log("register_native_shortcut_monitor failed_to_install");
        }
    }

    unsafe fn emit_focus_request(host_view: &GhosttyHostView) {
        let Some(manager) = GHOSTTY_MANAGER.get() else {
            return;
        };
        let Ok(state) = manager.lock() else {
            return;
        };
        let Some(runtime) = state.runtime.as_ref() else {
            return;
        };
        let Some(block_id) = runtime.blocks.iter().find_map(|(block_id, block)| {
            (block.host_view == (host_view as *const GhosttyHostView).cast::<c_void>() as usize)
                .then(|| block_id.clone())
        }) else {
            return;
        };
        drop(state);

        if let Some(app_handle) = APP_HANDLE.get() {
            let _ = app_handle.emit("ghostty-focus-block", GhosttyFocusEvent { block_id });
        }
    }

    fn lookup_block_context(host_view: &GhosttyHostView) -> Option<(String, GhosttySurface)> {
        let manager = GHOSTTY_MANAGER.get()?;
        let state = manager.lock().ok()?;
        let runtime = state.runtime.as_ref()?;
        let block = runtime.blocks.iter().find_map(|(_, block)| {
            (block.host_view == (host_view as *const GhosttyHostView).cast::<c_void>() as usize)
                .then_some(block)
        })?;
        Some((runtime.app_path.clone(), block.surface))
    }

    unsafe fn focus_host_view_surface(host_view: &GhosttyHostView, focused: bool) {
        let Some((app_path, surface)) = lookup_block_context(host_view) else {
            return;
        };
        let Ok(api) = (unsafe { api_for_app(Path::new(&app_path)) }) else {
            return;
        };
        unsafe { (api.surface_set_focus)(surface, focused) };
    }

    unsafe fn handle_host_view_mouse_move(host_view: &GhosttyHostView, event: &NSEvent) {
        let Some((app_path, surface)) = lookup_block_context(host_view) else {
            return;
        };
        let Ok(api) = (unsafe { api_for_app(Path::new(&app_path)) }) else {
            return;
        };
        let point = view_point_for_event(host_view, event);
        let bounds = host_view.bounds();
        unsafe {
            (api.surface_mouse_pos)(
                surface,
                point.x,
                bounds.size.height - point.y,
                ghostty_mods_from_event(event),
            )
        };
    }

    unsafe fn handle_host_view_mouse_button(
        host_view: &GhosttyHostView,
        event: &NSEvent,
        state_kind: GhosttyMouseState,
        button: GhosttyMouseButton,
    ) {
        let Some((app_path, surface)) = lookup_block_context(host_view) else {
            return;
        };
        let Ok(api) = (unsafe { api_for_app(Path::new(&app_path)) }) else {
            return;
        };
        let point = view_point_for_event(host_view, event);
        let bounds = host_view.bounds();
        unsafe {
            (api.surface_mouse_pos)(
                surface,
                point.x,
                bounds.size.height - point.y,
                ghostty_mods_from_event(event),
            );
            (api.surface_mouse_button)(surface, state_kind, button, ghostty_mods_from_event(event));
        }
    }

    unsafe fn handle_host_view_mouse_scroll(host_view: &GhosttyHostView, event: &NSEvent) {
        let Some((app_path, surface)) = lookup_block_context(host_view) else {
            return;
        };
        let Ok(api) = (unsafe { api_for_app(Path::new(&app_path)) }) else {
            return;
        };
        unsafe {
            (api.surface_mouse_scroll)(
                surface,
                event.deltaX(),
                event.deltaY(),
                ghostty_mods_from_event(event),
            );
        }
    }

    unsafe fn perform_host_view_action(host_view: &GhosttyHostView, action: &str) -> bool {
        let Some((app_path, surface)) = lookup_block_context(host_view) else {
            return false;
        };
        let Ok(api) = (unsafe { api_for_app(Path::new(&app_path)) }) else {
            return false;
        };
        let Ok(action) = CString::new(action) else {
            return false;
        };
        unsafe { (api.surface_binding_action)(surface, action.as_ptr(), action.as_bytes().len()) }
    }

    unsafe fn paste_host_view_from_clipboard(host_view: &GhosttyHostView) -> bool {
        let Some((app_path, surface)) = lookup_block_context(host_view) else {
            return false;
        };
        let Ok(api) = (unsafe { api_for_app(Path::new(&app_path)) }) else {
            return false;
        };
        let pasteboard = NSPasteboard::generalPasteboard();
        let Some(text) = pasteboard.stringForType(NSPasteboardTypeString) else {
            return false;
        };
        let Some(value) = string_from_nsstring(&text) else {
            return false;
        };
        let Ok(value) = CString::new(value) else {
            return false;
        };
        unsafe { (api.surface_text)(surface, value.as_ptr(), value.as_bytes().len()) };
        true
    }

    unsafe fn perform_host_view_key_equivalent(
        host_view: &GhosttyHostView,
        event: &NSEvent,
    ) -> bool {
        let flags = event
            .modifierFlags()
            .intersection(NSEventModifierFlags::DeviceIndependentFlagsMask);
        if !flags.contains(NSEventModifierFlags::Command)
            || flags.contains(NSEventModifierFlags::Control)
            || flags.contains(NSEventModifierFlags::Option)
        {
            return false;
        }
        let key = event
            .charactersIgnoringModifiers()
            .as_deref()
            .and_then(string_from_nsstring)
            .map(|value| value.to_lowercase());
        match key.as_deref() {
            Some("c") => unsafe { perform_host_view_action(host_view, "copy_to_clipboard") },
            Some("v") => unsafe { paste_host_view_from_clipboard(host_view) },
            Some("a") => unsafe { perform_host_view_action(host_view, "select_all") },
            Some("x") => unsafe { perform_host_view_action(host_view, "copy_to_clipboard") },
            _ => false,
        }
    }

    unsafe fn handle_host_view_key_event(
        host_view: &GhosttyHostView,
        event: &NSEvent,
        action: GhosttyInputAction,
    ) {
        let Some((app_path, surface)) = lookup_block_context(host_view) else {
            return;
        };
        let Ok(api) = (unsafe { api_for_app(Path::new(&app_path)) }) else {
            return;
        };

        let text = event.characters().and_then(|chars| {
            let raw = chars.UTF8String();
            if raw.is_null() {
                return None;
            }
            let value = unsafe { std::ffi::CStr::from_ptr(raw) }
                .to_string_lossy()
                .to_string();
            if value.is_empty()
                || event
                    .modifierFlags()
                    .contains(NSEventModifierFlags::Command)
            {
                None
            } else {
                CString::new(value).ok()
            }
        });

        if matches!(
            key_event_action(action, event.isARepeat()),
            GhosttyInputAction::Press | GhosttyInputAction::Repeat
        ) && matches!(event.keyCode(), 36 | 76)
        {
            ghostty_debug_log(&format!(
                "surface_key enter keycode={} repeat={} mods={}",
                event.keyCode(),
                event.isARepeat(),
                ghostty_mods_from_event(event)
            ));
        }

        let key_event = GhosttyInputKey {
            action: key_event_action(action, event.isARepeat()),
            mods: ghostty_mods_from_event(event),
            consumed_mods: consumed_mods_from_event(event),
            keycode: u32::from(event.keyCode()),
            text: text
                .as_ref()
                .map_or(std::ptr::null(), |value| value.as_ptr()),
            unshifted_codepoint: unshifted_codepoint_from_event(event),
            composing: false,
        };

        unsafe {
            (api.surface_set_focus)(surface, true);
            (api.surface_key)(surface, key_event);
        }
        if matches!(event.keyCode(), 36 | 76) {
            ghostty_debug_log("surface_key enter dispatched");
        }
    }

    unsafe extern "C" fn ghostty_wakeup_cb(_userdata: *mut c_void) {
        let Some(app_handle) = APP_HANDLE.get().cloned() else {
            return;
        };
        let Some(manager) = GHOSTTY_MANAGER.get().cloned() else {
            return;
        };

        let _ = app_handle.run_on_main_thread(move || {
            let app = manager
                .lock()
                .ok()
                .and_then(|state| state.runtime.as_ref().map(|runtime| runtime.app));
            if let (Some(api), Some(app)) = (GHOSTTY_API.get(), app) {
                ghostty_debug_log("wakeup_cb app_tick");
                unsafe { (api.app_tick)(app) };
                ghostty_debug_log("wakeup_cb app_tick done");
            }
        });
    }

    unsafe extern "C" fn ghostty_action_cb(
        _app: GhosttyApp,
        target: GhosttyTarget,
        action: GhosttyAction,
    ) -> bool {
        const GHOSTTY_ACTION_SHOW_CHILD_EXITED: i32 = 54;
        ghostty_debug_log(&format!("action_cb tag={}", action.tag));
        if action.tag != GHOSTTY_ACTION_SHOW_CHILD_EXITED {
            return false;
        }

        let Some(manager) = GHOSTTY_MANAGER.get().cloned() else {
            return false;
        };
        let Some(app_handle) = APP_HANDLE.get().cloned() else {
            return false;
        };
        let surface = unsafe { target.target.surface };
        let Ok(state) = manager.lock() else {
            return false;
        };
        let Some(runtime) = state.runtime.as_ref() else {
            return false;
        };
        let Some((block_id, host_view_ptr)) =
            runtime.blocks.iter().find_map(|(block_id, block)| {
                (block.surface == surface).then(|| (block_id.clone(), block.host_view))
            })
        else {
            ghostty_debug_log("action_cb child-exit surface not found");
            return false;
        };
        drop(state);
        ghostty_debug_log(&format!("action_cb show_child_exited block_id={block_id}"));

        let app_handle_for_emit = app_handle.clone();
        let _ = app_handle.run_on_main_thread(move || unsafe {
            ghostty_debug_log(&format!("action_cb main_thread block_id={block_id}"));
            close_block_after_child_exit_inner(host_view_ptr);
            ghostty_debug_log(&format!("action_cb emit_close block_id={block_id}"));
            let _ = app_handle_for_emit.emit(
                "ghostty-close-block",
                GhosttyCloseEvent {
                    block_id,
                    process_alive: false,
                },
            );
        });
        true
    }

    unsafe extern "C" fn ghostty_read_clipboard_cb(
        _userdata: *mut c_void,
        _location: GhosttyClipboard,
        _state: *mut c_void,
    ) {
    }

    unsafe extern "C" fn ghostty_confirm_read_clipboard_cb(
        _userdata: *mut c_void,
        _string: *const c_char,
        _state: *mut c_void,
        _request: GhosttyClipboardRequest,
    ) {
    }

    unsafe extern "C" fn ghostty_write_clipboard_cb(
        _userdata: *mut c_void,
        _content: *const c_char,
        _location: GhosttyClipboard,
        _confirm: bool,
    ) {
        if _content.is_null() {
            return;
        }
        let Ok(content) = unsafe { std::ffi::CStr::from_ptr(_content) }.to_str() else {
            return;
        };
        let pasteboard = NSPasteboard::generalPasteboard();
        let content = NSString::from_str(content);
        let _ = pasteboard.clearContents();
        let _ = pasteboard.setString_forType(&content, NSPasteboardTypeString);
    }

    unsafe extern "C" fn ghostty_close_surface_cb(userdata: *mut c_void, process_alive: bool) {
        ghostty_debug_log(&format!("close_surface_cb process_alive={process_alive}"));
        let Some(manager) = GHOSTTY_MANAGER.get().cloned() else {
            return;
        };
        let Some(app_handle) = APP_HANDLE.get().cloned() else {
            return;
        };
        let Ok(state) = manager.lock() else {
            ghostty_debug_log("close_surface_cb failed_lock");
            return;
        };
        ghostty_debug_log("close_surface_cb locked");
        let Some(runtime) = state.runtime.as_ref() else {
            return;
        };
        let Some(block_id) = runtime.blocks.iter().find_map(|(block_id, block)| {
            (block.host_view == userdata as usize).then(|| block_id.clone())
        }) else {
            ghostty_debug_log("close_surface_cb host view not found");
            return;
        };
        drop(state);
        ghostty_debug_log(&format!("close_surface_cb block_id={block_id}"));

        let app_handle_for_emit = app_handle.clone();
        let host_view_ptr = userdata as usize;
        let _ = app_handle.run_on_main_thread(move || unsafe {
            ghostty_debug_log(&format!("close_surface_cb main_thread block_id={block_id}"));
            close_block_after_child_exit_inner(host_view_ptr);
            ghostty_debug_log(&format!("close_surface_cb emit_close block_id={block_id}"));
            let _ = app_handle_for_emit.emit(
                "ghostty-close-block",
                GhosttyCloseEvent {
                    block_id,
                    process_alive,
                },
            );
        });
    }

    unsafe fn load_symbol<T: Copy>(library: &'static Library, name: &[u8]) -> Result<T, String> {
        let symbol = library.get::<T>(name).map_err(|error| error.to_string())?;
        Ok(*symbol)
    }

    pub(super) fn find_ghostty_app_path() -> Result<PathBuf, String> {
        if let Ok(path) = std::env::var("OTTO_CANVAS_GHOSTTY_APP") {
            let path = PathBuf::from(path);
            if path.exists() {
                return Ok(path);
            }
        }

        let default = PathBuf::from("/Applications/Ghostty.app/Contents/MacOS/ghostty");
        if default.exists() {
            return Ok(default);
        }

        Err("Ghostty.app was not found. Install Ghostty to /Applications or set OTTO_CANVAS_GHOSTTY_APP.".into())
    }

    pub(super) fn ghostty_resources_dir(app_path: &Path) -> Result<PathBuf, String> {
        let resources = app_path
            .parent()
            .and_then(Path::parent)
            .map(|path| path.join("Resources"))
            .ok_or_else(|| "Failed to resolve Ghostty resources directory".to_string())?;
        if resources.exists() {
            Ok(resources)
        } else {
            Err(format!(
                "Ghostty resources directory not found at {}",
                resources.display()
            ))
        }
    }

    pub(super) fn ghostty_frameworks_dir(app_path: &Path) -> Result<PathBuf, String> {
        let frameworks = app_path
            .parent()
            .and_then(Path::parent)
            .map(|path| path.join("Frameworks"))
            .ok_or_else(|| "Failed to resolve Ghostty frameworks directory".to_string())?;
        if frameworks.exists() {
            Ok(frameworks)
        } else {
            Err(format!(
                "Ghostty frameworks directory not found at {}",
                frameworks.display()
            ))
        }
    }

    fn prepend_env_path(key: &str, value: &Path) {
        let mut combined = value.as_os_str().to_os_string();
        if let Some(existing) = std::env::var_os(key) {
            if !existing.is_empty() {
                combined.push(":");
                combined.push(existing);
            }
        }
        std::env::set_var(key, combined);
    }

    unsafe fn preload_ghostty_dependencies(frameworks_dir: &Path) -> Result<(), String> {
        prepend_env_path("DYLD_FRAMEWORK_PATH", frameworks_dir);
        prepend_env_path("DYLD_FALLBACK_FRAMEWORK_PATH", frameworks_dir);

        let sparkle = frameworks_dir.join("Sparkle.framework/Versions/B/Sparkle");
        if sparkle.exists() {
            let _ = Box::leak(Box::new(
                unsafe { Library::open(Some(&sparkle), RTLD_NOW | RTLD_GLOBAL) }
                    .map_err(|error| error.to_string())?,
            ));
        }

        Ok(())
    }

    unsafe fn api_for_app(app_path: &Path) -> Result<&'static GhosttyApi, String> {
        if let Some(api) = GHOSTTY_API.get() {
            return Ok(api);
        }

        let frameworks_dir = ghostty_frameworks_dir(app_path)?;
        unsafe { preload_ghostty_dependencies(&frameworks_dir)? };
        let library = Box::leak(Box::new(
            unsafe { Library::open(Some(app_path), RTLD_NOW | RTLD_GLOBAL) }
                .map_err(|error| error.to_string())?,
        ));
        let api = GhosttyApi {
            init: unsafe { load_symbol(library, b"ghostty_init\0")? },
            config_new: unsafe { load_symbol(library, b"ghostty_config_new\0")? },
            config_load_default_files: unsafe {
                load_symbol(library, b"ghostty_config_load_default_files\0")?
            },
            config_load_recursive_files: unsafe {
                load_symbol(library, b"ghostty_config_load_recursive_files\0")?
            },
            config_finalize: unsafe { load_symbol(library, b"ghostty_config_finalize\0")? },
            app_new: unsafe { load_symbol(library, b"ghostty_app_new\0")? },
            app_tick: unsafe { load_symbol(library, b"ghostty_app_tick\0")? },
            surface_config_new: unsafe { load_symbol(library, b"ghostty_surface_config_new\0")? },
            surface_new: unsafe { load_symbol(library, b"ghostty_surface_new\0")? },
            surface_free: unsafe { load_symbol(library, b"ghostty_surface_free\0")? },
            surface_set_content_scale: unsafe {
                load_symbol(library, b"ghostty_surface_set_content_scale\0")?
            },
            surface_set_size: unsafe { load_symbol(library, b"ghostty_surface_set_size\0")? },
            surface_set_focus: unsafe { load_symbol(library, b"ghostty_surface_set_focus\0")? },
            surface_text: unsafe { load_symbol(library, b"ghostty_surface_text\0")? },
            surface_key: unsafe { load_symbol(library, b"ghostty_surface_key\0")? },
            surface_mouse_button: unsafe {
                load_symbol(library, b"ghostty_surface_mouse_button\0")?
            },
            surface_mouse_pos: unsafe { load_symbol(library, b"ghostty_surface_mouse_pos\0")? },
            surface_mouse_scroll: unsafe {
                load_symbol(library, b"ghostty_surface_mouse_scroll\0")?
            },
            surface_binding_action: unsafe {
                load_symbol(library, b"ghostty_surface_binding_action\0")?
            },
        };
        let _ = GHOSTTY_API.set(api);
        GHOSTTY_API
            .get()
            .ok_or_else(|| "Failed to cache Ghostty API bindings".to_string())
    }

    pub(super) unsafe fn init_runtime(state: &mut GhosttyState) -> Result<(), String> {
        if state.runtime.is_some() {
            return Ok(());
        }

        let app_path = find_ghostty_app_path()?;
        let resources_dir = ghostty_resources_dir(&app_path)?;
        std::env::set_var("GHOSTTY_RESOURCES_DIR", &resources_dir);

        let api = unsafe { api_for_app(&app_path)? };
        let mut argv_storage = std::env::args_os()
            .map(|arg| {
                CString::new(arg.to_string_lossy().as_bytes())
                    .map_err(|_| "Process argv contained a null byte".to_string())
            })
            .collect::<Result<Vec<_>, _>>()?;
        if argv_storage.is_empty() {
            argv_storage.push(CString::new("otto-canvas").expect("static string is valid"));
        }
        let mut argv = argv_storage
            .iter_mut()
            .map(|arg| arg.as_ptr() as *mut c_char)
            .collect::<Vec<_>>();
        if unsafe { (api.init)(argv.len(), argv.as_mut_ptr()) } != 0 {
            return Err("ghostty_init failed".into());
        }

        let config = unsafe { (api.config_new)() };
        if config.is_null() {
            return Err("ghostty_config_new returned a null pointer".into());
        }
        unsafe {
            (api.config_load_default_files)(config);
            (api.config_load_recursive_files)(config);
            (api.config_finalize)(config);
        }

        let runtime_userdata = APP_HANDLE
            .get()
            .map(|handle| handle as *const AppHandle<Wry> as *mut c_void)
            .unwrap_or_else(|| std::ptr::dangling_mut::<c_void>());

        let runtime_config = GhosttyRuntimeConfig {
            userdata: runtime_userdata,
            supports_selection_clipboard: true,
            wakeup_cb: Some(ghostty_wakeup_cb),
            action_cb: Some(ghostty_action_cb),
            read_clipboard_cb: Some(ghostty_read_clipboard_cb),
            confirm_read_clipboard_cb: Some(ghostty_confirm_read_clipboard_cb),
            write_clipboard_cb: Some(ghostty_write_clipboard_cb),
            close_surface_cb: Some(ghostty_close_surface_cb),
        };

        let app = unsafe { (api.app_new)(&runtime_config, config) };
        if app.is_null() {
            return Err("ghostty_app_new returned a null pointer".into());
        }

        state.runtime = Some(GhosttyRuntime {
            app_path: app_path.display().to_string(),
            _resources_dir: resources_dir.display().to_string(),
            app,
            _config: config,
            blocks: HashMap::new(),
        });

        Ok(())
    }

    pub(super) unsafe fn create_block_inner(
        window: &WebviewWindow,
        manager: &Arc<Mutex<GhosttyState>>,
        block_id: &str,
        cwd: Option<&str>,
        command: Option<&str>,
    ) -> Result<(), String> {
        let mtm = MainThreadMarker::new()
            .ok_or_else(|| "Ghostty block creation must run on the main thread".to_string())?;
        let mut state = manager
            .lock()
            .map_err(|_| "Failed to lock Ghostty manager state".to_string())?;
        unsafe { init_runtime(&mut state)? };
        let runtime = state
            .runtime
            .as_mut()
            .ok_or_else(|| "Ghostty runtime was not initialized".to_string())?;

        if runtime.blocks.contains_key(block_id) {
            return Ok(());
        }

        let api = unsafe { api_for_app(Path::new(&runtime.app_path))? };
        let webview_ptr = window.ns_view().map_err(|error| error.to_string())?;
        let webview = unsafe { &*(webview_ptr.cast::<NSView>()) };
        let parent = unsafe { webview.superview() }
            .ok_or_else(|| "Failed to get the Canvas webview parent view".to_string())?;

        let host_view = GhosttyHostView::new(
            mtm,
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(0.0, 0.0)),
        );
        host_view.setHidden(true);
        parent.addSubview_positioned_relativeTo(
            &host_view,
            NSWindowOrderingMode::Above,
            Some(webview),
        );

        let cwd_value = cwd
            .map(ToOwned::to_owned)
            .or_else(|| {
                std::env::current_dir()
                    .ok()
                    .map(|path| path.display().to_string())
            })
            .or_else(|| dirs::home_dir().map(|path| path.display().to_string()));
        let cwd_cstring = cwd_value
            .as_deref()
            .map(CString::new)
            .transpose()
            .map_err(|_| "Working directory contained a null byte".to_string())?;
        let command_cstring = command
            .map(CString::new)
            .transpose()
            .map_err(|_| "Command contained a null byte".to_string())?;
        let terminfo_dir = Path::new(&runtime._resources_dir).join("terminfo");
        let env_storage = [
            ("GHOSTTY_RESOURCES_DIR", runtime._resources_dir.as_str()),
            ("TERMINFO", terminfo_dir.to_string_lossy().as_ref()),
            ("TERM", "xterm-ghostty"),
            ("COLORTERM", "truecolor"),
        ]
        .into_iter()
        .map(|(key, value)| {
            Ok::<_, String>((
                CString::new(key)
                    .map_err(|_| format!("Env var key contained a null byte: {key}"))?,
                CString::new(value)
                    .map_err(|_| format!("Env var value contained a null byte: {key}"))?,
            ))
        })
        .collect::<Result<Vec<_>, _>>()?;
        let mut env_vars = env_storage
            .iter()
            .map(|(key, value)| GhosttyEnvVar {
                key: key.as_ptr(),
                value: value.as_ptr(),
            })
            .collect::<Vec<_>>();

        let mut surface_config = unsafe { (api.surface_config_new)() };
        surface_config.platform_tag = GhosttyPlatform::Macos;
        surface_config.platform = GhosttyPlatformUnion {
            macos: GhosttyPlatformMacos {
                nsview: (&*host_view as *const GhosttyHostView).cast_mut().cast(),
            },
        };
        surface_config.userdata = (&*host_view as *const GhosttyHostView).cast_mut().cast();
        surface_config.scale_factor = scale_factor_for_view(&host_view);
        surface_config.font_size = 12.0;
        surface_config.working_directory = cwd_cstring
            .as_ref()
            .map_or(std::ptr::null(), |value| value.as_ptr());
        surface_config.command = command_cstring
            .as_ref()
            .map_or(std::ptr::null(), |value| value.as_ptr());
        surface_config.env_vars = env_vars.as_mut_ptr();
        surface_config.env_var_count = env_vars.len();
        surface_config.initial_input = std::ptr::null();
        surface_config.wait_after_command = false;
        surface_config.context = GhosttySurfaceContext::Window;

        let surface = unsafe { (api.surface_new)(runtime.app, &mut surface_config) };
        if surface.is_null() {
            host_view.removeFromSuperview();
            return Err("ghostty_surface_new returned a null pointer".into());
        }

        let font_action = CString::new("set_font_size:12").expect("static string is valid");
        unsafe {
            (api.surface_binding_action)(
                surface,
                font_action.as_ptr(),
                font_action.as_bytes().len(),
            );
        }

        runtime.blocks.insert(
            block_id.to_string(),
            GhosttyBlock {
                surface,
                host_view: Retained::into_raw(host_view) as usize,
            },
        );

        Ok(())
    }

    pub(super) unsafe fn update_block_inner(
        window: &WebviewWindow,
        manager: &Arc<Mutex<GhosttyState>>,
        block_id: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        viewport_height: f64,
        scale_factor: f64,
        focused: bool,
        hidden: bool,
    ) -> Result<(), String> {
        let state = manager
            .lock()
            .map_err(|_| "Failed to lock Ghostty manager state".to_string())?;
        let runtime = state
            .runtime
            .as_ref()
            .ok_or_else(|| "Ghostty runtime was not initialized".to_string())?;
        let block = runtime
            .blocks
            .get(block_id)
            .ok_or_else(|| format!("Ghostty block {block_id} was not found"))?;
        let api = unsafe { api_for_app(Path::new(&runtime.app_path))? };
        let host_view = unsafe { &*(block.host_view as *const GhosttyHostView) };

        let webview_ptr = window.ns_view().map_err(|error| error.to_string())?;
        let webview = unsafe { &*(webview_ptr.cast::<NSView>()) };

        let flipped_y = (viewport_height - y - height).max(0.0);
        let rect_in_webview = NSRect::new(
            NSPoint::new(x.max(0.0), flipped_y),
            NSSize::new(width.max(0.0), height.max(0.0)),
        );

        let parent =
            unsafe { webview.superview() }.ok_or_else(|| "Webview has no superview".to_string())?;
        let rect_in_parent = parent.convertRect_fromView(rect_in_webview, Some(webview));

        host_view.setFrame(rect_in_parent);
        host_view.setHidden(hidden || width < 1.0 || height < 1.0);

        let needs_reparent = host_view
            .superview()
            .map_or(true, |current| !current.isEqual(Some(&*parent)));
        if needs_reparent {
            host_view.removeFromSuperview();
            parent.addSubview_positioned_relativeTo(
                host_view,
                NSWindowOrderingMode::Above,
                Some(webview),
            );
        }

        if !hidden {
            unsafe {
                (api.surface_set_content_scale)(block.surface, scale_factor, scale_factor);
                (api.surface_set_size)(
                    block.surface,
                    (width.max(0.0) * scale_factor).round() as u32,
                    (height.max(0.0) * scale_factor).round() as u32,
                );
            }
        }
        let _ = focused;

        Ok(())
    }

    pub(super) unsafe fn input_text_inner(
        manager: &Arc<Mutex<GhosttyState>>,
        block_id: &str,
        text: &str,
    ) -> Result<(), String> {
        if text.is_empty() {
            return Ok(());
        }

        let state = manager
            .lock()
            .map_err(|_| "Failed to lock Ghostty manager state".to_string())?;
        let runtime = state
            .runtime
            .as_ref()
            .ok_or_else(|| "Ghostty runtime was not initialized".to_string())?;
        let block = runtime
            .blocks
            .get(block_id)
            .ok_or_else(|| format!("Ghostty block {block_id} was not found"))?;
        let api = unsafe { api_for_app(Path::new(&runtime.app_path))? };
        let text = CString::new(text).map_err(|_| "Input contained a null byte".to_string())?;
        unsafe { (api.surface_text)(block.surface, text.as_ptr(), text.as_bytes().len()) };
        Ok(())
    }

    pub(super) unsafe fn input_key_inner(
        manager: &Arc<Mutex<GhosttyState>>,
        block_id: &str,
        keycode: u32,
        mods: i32,
        text: Option<&str>,
        composing: bool,
        action: &str,
    ) -> Result<(), String> {
        let state = manager
            .lock()
            .map_err(|_| "Failed to lock Ghostty manager state".to_string())?;
        let runtime = state
            .runtime
            .as_ref()
            .ok_or_else(|| "Ghostty runtime was not initialized".to_string())?;
        let block = runtime
            .blocks
            .get(block_id)
            .ok_or_else(|| format!("Ghostty block {block_id} was not found"))?;
        let api = unsafe { api_for_app(Path::new(&runtime.app_path))? };
        let text = text
            .map(CString::new)
            .transpose()
            .map_err(|_| "Key text contained a null byte".to_string())?;
        let action = match action {
            "repeat" => GhosttyInputAction::Repeat,
            "release" => GhosttyInputAction::Release,
            _ => GhosttyInputAction::Press,
        };
        let event = GhosttyInputKey {
            action,
            mods,
            consumed_mods: 0,
            keycode,
            text: text
                .as_ref()
                .map_or(std::ptr::null(), |value| value.as_ptr()),
            unshifted_codepoint: 0,
            composing,
        };
        unsafe {
            (api.surface_key)(block.surface, event);
        }
        Ok(())
    }

    pub(super) unsafe fn set_block_focus_inner(
        manager: &Arc<Mutex<GhosttyState>>,
        block_id: &str,
        focused: bool,
    ) -> Result<(), String> {
        let (app_path, surface, host_view_ptr) = {
            let state = manager
                .lock()
                .map_err(|_| "Failed to lock Ghostty manager state".to_string())?;
            let runtime = state
                .runtime
                .as_ref()
                .ok_or_else(|| "Ghostty runtime was not initialized".to_string())?;
            let block = runtime
                .blocks
                .get(block_id)
                .ok_or_else(|| format!("Ghostty block {block_id} was not found"))?;
            (runtime.app_path.clone(), block.surface, block.host_view)
        };
        let api = unsafe { api_for_app(Path::new(&app_path))? };
        let host_view = unsafe { &*(host_view_ptr as *const GhosttyHostView) };

        if focused {
            if let Some(window) = host_view.window() {
                let _ = window.makeFirstResponder(Some(host_view));
            }
            unsafe { (api.surface_set_focus)(surface, true) };
        } else {
            unsafe { (api.surface_set_focus)(surface, false) };
            let _: bool = unsafe { msg_send![host_view, resignFirstResponder] };
            if let Some(window) = host_view.window() {
                let _ = window.makeFirstResponder(None::<&NSResponder>);
            }
        }

        Ok(())
    }

    pub(super) unsafe fn close_block_after_child_exit_inner(host_view_ptr: usize) {
        ghostty_debug_log(&format!(
            "close_block_after_child_exit_inner start host_view_ptr={host_view_ptr}"
        ));
        let host_view = unsafe { &*(host_view_ptr as *const GhosttyHostView) };
        ghostty_debug_log("close_block_after_child_exit_inner setHidden");
        host_view.setHidden(true);
        ghostty_debug_log("close_block_after_child_exit_inner removeFromSuperview");
        host_view.removeFromSuperview();
        ghostty_debug_log("close_block_after_child_exit_inner done");
    }

    pub(super) unsafe fn destroy_block_inner(
        manager: &Arc<Mutex<GhosttyState>>,
        block_id: &str,
    ) -> Result<(), String> {
        let mut state = manager
            .lock()
            .map_err(|_| "Failed to lock Ghostty manager state".to_string())?;
        let runtime = state
            .runtime
            .as_mut()
            .ok_or_else(|| "Ghostty runtime was not initialized".to_string())?;
        let Some(block) = runtime.blocks.remove(block_id) else {
            return Ok(());
        };
        let api = unsafe { api_for_app(Path::new(&runtime.app_path))? };

        unsafe { (api.surface_free)(block.surface) };
        let host_view = unsafe { Retained::from_raw(block.host_view as *mut GhosttyHostView) }
            .ok_or_else(|| "Ghostty host view pointer was invalid".to_string())?;
        host_view.removeFromSuperview();
        drop(host_view);
        Ok(())
    }
}

#[cfg(target_os = "macos")]
use macos::{
    create_block_inner, destroy_block_inner, input_key_inner, input_text_inner,
    set_block_focus_inner, update_block_inner,
};

#[cfg(target_os = "macos")]
type GhosttyApp = *mut c_void;
#[cfg(target_os = "macos")]
type GhosttyConfig = *mut c_void;
#[cfg(target_os = "macos")]
type GhosttySurface = *mut c_void;
