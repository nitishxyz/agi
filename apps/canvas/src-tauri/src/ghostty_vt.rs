use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{Arc, Mutex, OnceLock},
};

#[derive(Clone, Default)]
pub struct GhosttyVtManager {
    #[allow(dead_code)]
    inner: Arc<Mutex<HashMap<String, Arc<imp::SessionHandle>>>>,
}

static REGISTERED_MANAGER: OnceLock<Arc<Mutex<HashMap<String, Arc<imp::SessionHandle>>>>> =
    OnceLock::new();

pub(crate) fn register_manager(manager: &GhosttyVtManager) {
    let _ = REGISTERED_MANAGER.set(manager.inner.clone());
}

fn registered_manager() -> Result<&'static Arc<Mutex<HashMap<String, Arc<imp::SessionHandle>>>>, String> {
    REGISTERED_MANAGER
        .get()
        .ok_or_else(|| "libghostty-vt manager is not registered".to_string())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhosttyVtStatus {
    pub available: bool,
    pub message: String,
    pub source_dir: Option<String>,
    pub lib_dir: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhosttyVtRgb {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhosttyVtCell {
    pub text: String,
    pub fg: Option<GhosttyVtRgb>,
    pub bg: Option<GhosttyVtRgb>,
    pub bold: bool,
    pub italic: bool,
    pub dim: bool,
    pub underline: bool,
    pub strikethrough: bool,
    pub invisible: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhosttyVtRow {
    pub cells: Vec<GhosttyVtCell>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhosttyVtCursor {
    pub visible: bool,
    pub blinking: bool,
    pub x: Option<u16>,
    pub y: Option<u16>,
    pub shape: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GhosttyVtSnapshot {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
    pub screen_text: String,
    pub rows_data: Vec<GhosttyVtRow>,
    pub default_fg: GhosttyVtRgb,
    pub default_bg: GhosttyVtRgb,
    pub ansi_palette: Vec<GhosttyVtRgb>,
    pub cursor: GhosttyVtCursor,
    pub process_alive: bool,
    pub exit_status: Option<i32>,
}

#[tauri::command]
pub fn ghostty_vt_status() -> Result<GhosttyVtStatus, String> {
    imp::ghostty_vt_status()
}

#[tauri::command]
pub fn ghostty_vt_create_session(
    app_handle: tauri::AppHandle,
    manager: tauri::State<'_, GhosttyVtManager>,
    session_id: String,
    cwd: Option<String>,
    command: Option<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<(), String> {
    imp::ghostty_vt_create_session(
        &app_handle,
        manager.inner(),
        &session_id,
        cwd.as_deref(),
        command.as_deref(),
        cols,
        rows,
    )
}

#[tauri::command]
pub fn ghostty_vt_resize_session(
    manager: tauri::State<'_, GhosttyVtManager>,
    session_id: String,
    cols: u16,
    rows: u16,
    cell_width_px: Option<u32>,
    cell_height_px: Option<u32>,
) -> Result<(), String> {
    imp::ghostty_vt_resize_session(
        manager.inner(),
        &session_id,
        cols,
        rows,
        cell_width_px,
        cell_height_px,
    )
}

#[tauri::command]
pub fn ghostty_vt_send_text(
    manager: tauri::State<'_, GhosttyVtManager>,
    session_id: String,
    text: String,
) -> Result<(), String> {
    imp::ghostty_vt_send_text(manager.inner(), &session_id, &text)
}

#[tauri::command]
pub fn ghostty_vt_input_key(
    manager: tauri::State<'_, GhosttyVtManager>,
    session_id: String,
    code: String,
    key: String,
    text: Option<String>,
    ctrl: bool,
    alt: bool,
    shift: bool,
    meta: bool,
    repeat: bool,
) -> Result<(), String> {
    imp::ghostty_vt_input_key(
        manager.inner(),
        &session_id,
        &code,
        &key,
        text.as_deref(),
        ctrl,
        alt,
        shift,
        meta,
        repeat,
    )
}

#[tauri::command]
pub fn ghostty_vt_scroll_viewport(
    manager: tauri::State<'_, GhosttyVtManager>,
    session_id: String,
    delta: i64,
) -> Result<(), String> {
    imp::ghostty_vt_scroll_viewport(manager.inner(), &session_id, delta)
}

#[tauri::command]
pub fn ghostty_vt_snapshot_session(
    manager: tauri::State<'_, GhosttyVtManager>,
    session_id: String,
) -> Result<GhosttyVtSnapshot, String> {
    imp::ghostty_vt_snapshot_session(manager.inner(), &session_id)
}

#[tauri::command]
pub fn ghostty_vt_destroy_session(
    manager: tauri::State<'_, GhosttyVtManager>,
    session_id: String,
) -> Result<(), String> {
    imp::ghostty_vt_destroy_session(manager.inner(), &session_id)
}

pub(crate) fn create_registered_session(
    app_handle: &tauri::AppHandle,
    session_id: &str,
    cwd: Option<&str>,
    command: Option<&str>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    imp::ghostty_vt_create_session_in_map(
        app_handle,
        registered_manager()?,
        session_id,
        cwd,
        command,
        cols,
        rows,
    )
}

pub(crate) fn resize_registered_session(
    session_id: &str,
    cols: u16,
    rows: u16,
    cell_width_px: u32,
    cell_height_px: u32,
) -> Result<(), String> {
    imp::ghostty_vt_resize_session_in_map(
        registered_manager()?,
        session_id,
        cols,
        rows,
        cell_width_px,
        cell_height_px,
    )
}

pub(crate) fn send_text_registered_session(session_id: &str, text: &str) -> Result<(), String> {
    imp::ghostty_vt_send_text_in_map(registered_manager()?, session_id, text)
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn input_key_registered_session(
    session_id: &str,
    code: &str,
    key: &str,
    text: Option<&str>,
    ctrl: bool,
    alt: bool,
    shift: bool,
    meta: bool,
    repeat: bool,
) -> Result<(), String> {
    imp::ghostty_vt_input_key_in_map(
        registered_manager()?,
        session_id,
        code,
        key,
        text,
        ctrl,
        alt,
        shift,
        meta,
        repeat,
    )
}

pub(crate) fn snapshot_registered_session(session_id: &str) -> Result<GhosttyVtSnapshot, String> {
    imp::ghostty_vt_snapshot_session_in_map(registered_manager()?, session_id)
}

pub(crate) fn destroy_registered_session(session_id: &str) -> Result<(), String> {
    imp::ghostty_vt_destroy_session_in_map(registered_manager()?, session_id)
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn mouse_button_registered_session(
    session_id: &str,
    x_px: f64,
    y_px: f64,
    width_px: f64,
    height_px: f64,
    button: u8,
    pressed: bool,
    mods: u16,
) -> Result<bool, String> {
    imp::ghostty_vt_mouse_button_in_map(
        registered_manager()?,
        session_id,
        x_px,
        y_px,
        width_px,
        height_px,
        button,
        pressed,
        mods,
    )
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn mouse_motion_registered_session(
    session_id: &str,
    x_px: f64,
    y_px: f64,
    width_px: f64,
    height_px: f64,
    pressed_button: Option<u8>,
    mods: u16,
) -> Result<bool, String> {
    imp::ghostty_vt_mouse_motion_in_map(
        registered_manager()?,
        session_id,
        x_px,
        y_px,
        width_px,
        height_px,
        pressed_button,
        mods,
    )
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn mouse_scroll_registered_session(
    session_id: &str,
    x_px: f64,
    y_px: f64,
    width_px: f64,
    height_px: f64,
    delta_y: f64,
    precise: bool,
    mods: u16,
) -> Result<(), String> {
    imp::ghostty_vt_mouse_scroll_in_map(
        registered_manager()?,
        session_id,
        x_px,
        y_px,
        width_px,
        height_px,
        delta_y,
        precise,
        mods,
    )
}

#[cfg(not(otto_canvas_libghostty_vt))]
mod imp {
    pub(super) struct SessionHandle;

    use super::*;

    const UNAVAILABLE_MESSAGE: &str = "libghostty-vt prototype is not enabled for this build. Set OTTO_CANVAS_LIBGHOSTTY_VT_SOURCE_DIR to a Ghostty checkout (for example tmp/ghostty) or OTTO_CANVAS_LIBGHOSTTY_VT_LIB_DIR to a directory containing libghostty-vt.a before building apps/canvas/src-tauri.";

    pub fn ghostty_vt_status() -> Result<GhosttyVtStatus, String> {
        Ok(GhosttyVtStatus {
            available: false,
            message: UNAVAILABLE_MESSAGE.to_string(),
            source_dir: None,
            lib_dir: None,
        })
    }

    pub fn ghostty_vt_create_session(
        app_handle: &tauri::AppHandle,
        manager: &GhosttyVtManager,
        session_id: &str,
        cwd: Option<&str>,
        command: Option<&str>,
        cols: Option<u16>,
        rows: Option<u16>,
    ) -> Result<(), String> {
        let _ = (app_handle, manager, session_id, cwd, command, cols, rows);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_resize_session(
        manager: &GhosttyVtManager,
        session_id: &str,
        cols: u16,
        rows: u16,
        cell_width_px: Option<u32>,
        cell_height_px: Option<u32>,
    ) -> Result<(), String> {
        let _ = (
            manager,
            session_id,
            cols,
            rows,
            cell_width_px,
            cell_height_px,
        );
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_send_text(
        manager: &GhosttyVtManager,
        session_id: &str,
        text: &str,
    ) -> Result<(), String> {
        let _ = (manager, session_id, text);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_input_key(
        manager: &GhosttyVtManager,
        session_id: &str,
        code: &str,
        key: &str,
        text: Option<&str>,
        ctrl: bool,
        alt: bool,
        shift: bool,
        meta: bool,
        repeat: bool,
    ) -> Result<(), String> {
        let _ = (
            manager, session_id, code, key, text, ctrl, alt, shift, meta, repeat,
        );
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_input_key_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        code: &str,
        key: &str,
        text: Option<&str>,
        ctrl: bool,
        alt: bool,
        shift: bool,
        meta: bool,
        repeat: bool,
    ) -> Result<(), String> {
        let _ = (
            sessions, session_id, code, key, text, ctrl, alt, shift, meta, repeat,
        );
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_scroll_viewport(
        manager: &GhosttyVtManager,
        session_id: &str,
        delta: i64,
    ) -> Result<(), String> {
        let _ = (manager, session_id, delta);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_snapshot_session(
        manager: &GhosttyVtManager,
        session_id: &str,
    ) -> Result<GhosttyVtSnapshot, String> {
        let _ = (manager, session_id);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_destroy_session(
        manager: &GhosttyVtManager,
        session_id: &str,
    ) -> Result<(), String> {
        let _ = (manager, session_id);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_create_session_in_map(
        app_handle: &tauri::AppHandle,
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        cwd: Option<&str>,
        command: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let _ = (app_handle, sessions, session_id, cwd, command, cols, rows);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_resize_session_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        cols: u16,
        rows: u16,
        cell_width_px: u32,
        cell_height_px: u32,
    ) -> Result<(), String> {
        let _ = (sessions, session_id, cols, rows, cell_width_px, cell_height_px);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_send_text_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        text: &str,
    ) -> Result<(), String> {
        let _ = (sessions, session_id, text);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_scroll_viewport_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        delta: i64,
    ) -> Result<(), String> {
        let _ = (sessions, session_id, delta);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_snapshot_session_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
    ) -> Result<GhosttyVtSnapshot, String> {
        let _ = (sessions, session_id);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    pub fn ghostty_vt_destroy_session_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
    ) -> Result<(), String> {
        let _ = (sessions, session_id);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_mouse_button_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        x_px: f64,
        y_px: f64,
        width_px: f64,
        height_px: f64,
        button: u8,
        pressed: bool,
        mods: u16,
    ) -> Result<bool, String> {
        let _ = (
            sessions, session_id, x_px, y_px, width_px, height_px, button, pressed, mods,
        );
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_mouse_motion_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        x_px: f64,
        y_px: f64,
        width_px: f64,
        height_px: f64,
        pressed_button: Option<u8>,
        mods: u16,
    ) -> Result<bool, String> {
        let _ = (sessions, session_id, x_px, y_px, width_px, height_px, pressed_button, mods);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_mouse_scroll_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        x_px: f64,
        y_px: f64,
        width_px: f64,
        height_px: f64,
        delta_y: f64,
        precise: bool,
        mods: u16,
    ) -> Result<(), String> {
        let _ = (sessions, session_id, x_px, y_px, width_px, height_px, delta_y, precise, mods);
        Err(UNAVAILABLE_MESSAGE.to_string())
    }
}

#[cfg(otto_canvas_libghostty_vt)]
mod imp {
    use super::{
        GhosttyVtCell, GhosttyVtCursor, GhosttyVtManager, GhosttyVtRgb, GhosttyVtRow,
        GhosttyVtSnapshot, GhosttyVtStatus,
    };
    use serde::Serialize;
    use std::{
        collections::HashMap,
        ffi::{c_char, c_int, c_void, CString},
        io, mem,
        os::fd::RawFd,
        path::Path,
        ptr, slice,
        sync::{
            atomic::{AtomicBool, AtomicI32, Ordering},
            Arc, Mutex,
        },
        thread::{self, JoinHandle},
    };
    use tauri::{AppHandle, Emitter};

    const GHOSTTY_SUCCESS: i32 = 0;
    const GHOSTTY_TERMINAL_OPT_USERDATA: i32 = 0;
    const GHOSTTY_TERMINAL_OPT_WRITE_PTY: i32 = 1;
    const GHOSTTY_TERMINAL_OPT_XTVERSION: i32 = 4;
    const GHOSTTY_TERMINAL_OPT_SIZE: i32 = 6;
    const GHOSTTY_TERMINAL_OPT_DEVICE_ATTRIBUTES: i32 = 8;
    const GHOSTTY_SCROLL_VIEWPORT_DELTA: i32 = 2;
    const GHOSTTY_RENDER_STATE_DATA_ROW_ITERATOR: i32 = 4;
    const GHOSTTY_RENDER_STATE_DATA_CURSOR_VISUAL_STYLE: i32 = 10;
    const GHOSTTY_RENDER_STATE_DATA_CURSOR_VISIBLE: i32 = 11;
    const GHOSTTY_RENDER_STATE_DATA_CURSOR_BLINKING: i32 = 12;
    const GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_HAS_VALUE: i32 = 14;
    const GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_X: i32 = 15;
    const GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_Y: i32 = 16;
    const GHOSTTY_RENDER_STATE_ROW_DATA_CELLS: i32 = 3;
    const GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_STYLE: i32 = 2;
    const GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_LEN: i32 = 3;
    const GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_BUF: i32 = 4;
    const GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_BG_COLOR: i32 = 5;
    const GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_FG_COLOR: i32 = 6;
    const GHOSTTY_KEY_ACTION_PRESS: i32 = 1;
    const GHOSTTY_KEY_ACTION_REPEAT: i32 = 2;
    const GHOSTTY_TERMINAL_DATA_MOUSE_TRACKING: i32 = 11;
    const GHOSTTY_MOUSE_ENCODER_OPT_SIZE: i32 = 2;
    const GHOSTTY_MOUSE_ENCODER_OPT_ANY_BUTTON_PRESSED: i32 = 3;
    const GHOSTTY_MOUSE_ENCODER_OPT_TRACK_LAST_CELL: i32 = 4;
    const GHOSTTY_MOUSE_ACTION_PRESS: i32 = 0;
    const GHOSTTY_MOUSE_ACTION_RELEASE: i32 = 1;
    const GHOSTTY_MOUSE_ACTION_MOTION: i32 = 2;
    const GHOSTTY_MOUSE_BUTTON_UNKNOWN: i32 = 0;
    const GHOSTTY_MOUSE_BUTTON_LEFT: i32 = 1;
    const GHOSTTY_MOUSE_BUTTON_RIGHT: i32 = 2;
    const GHOSTTY_MOUSE_BUTTON_MIDDLE: i32 = 3;
    const GHOSTTY_MOUSE_BUTTON_FOUR: i32 = 4;
    const GHOSTTY_MOUSE_BUTTON_FIVE: i32 = 5;
    const GHOSTTY_MODS_SHIFT: u16 = 1 << 0;
    const GHOSTTY_MODS_CTRL: u16 = 1 << 1;
    const GHOSTTY_MODS_ALT: u16 = 1 << 2;
    const GHOSTTY_MODS_SUPER: u16 = 1 << 3;
    const EXIT_STATUS_RUNNING: i32 = i32::MIN;
    const DEFAULT_COLS: u16 = 80;
    const DEFAULT_ROWS: u16 = 24;
    const DEFAULT_CELL_WIDTH_PX: u32 = 8;
    const DEFAULT_CELL_HEIGHT_PX: u32 = 16;
    const XTVERSION: &[u8] = b"otto-canvas libghostty-vt";

    type GhosttyResult = i32;
    type GhosttyTerminal = *mut c_void;
    type GhosttyRenderState = *mut c_void;
    type GhosttyRenderStateRowIterator = *mut c_void;
    type GhosttyRenderStateRowCells = *mut c_void;
    type GhosttyKeyEncoder = *mut c_void;
    type GhosttyKeyEvent = *mut c_void;
    type GhosttyMouseEncoder = *mut c_void;
    type GhosttyMouseEvent = *mut c_void;
    type GhosttyAllocator = c_void;

    #[repr(C)]
    struct GhosttyTerminalOptions {
        cols: u16,
        rows: u16,
        max_scrollback: usize,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct GhosttyColorRgb {
        r: u8,
        g: u8,
        b: u8,
    }

    #[repr(C)]
    struct GhosttyString {
        ptr: *const u8,
        len: usize,
    }

    #[repr(C)]
    struct GhosttyRenderStateColors {
        size: usize,
        background: GhosttyColorRgb,
        foreground: GhosttyColorRgb,
        cursor: GhosttyColorRgb,
        cursor_has_value: bool,
        palette: [GhosttyColorRgb; 256],
    }

    #[repr(C)]
    struct GhosttyStyleColor {
        tag: i32,
        value: [u8; 8],
    }

    #[repr(C)]
    struct GhosttyStyle {
        size: usize,
        fg_color: GhosttyStyleColor,
        bg_color: GhosttyStyleColor,
        underline_color: GhosttyStyleColor,
        bold: bool,
        italic: bool,
        faint: bool,
        blink: bool,
        inverse: bool,
        invisible: bool,
        strikethrough: bool,
        overline: bool,
        underline: i32,
    }

    #[repr(C)]
    union GhosttyTerminalScrollViewportValue {
        delta: isize,
        _padding: [u64; 2],
    }

    #[repr(C)]
    struct GhosttyTerminalScrollViewport {
        tag: i32,
        value: GhosttyTerminalScrollViewportValue,
    }

    #[repr(C)]
    struct GhosttyMousePosition {
        x: f32,
        y: f32,
    }

    #[repr(C)]
    struct GhosttyMouseEncoderSize {
        size: usize,
        screen_width: u32,
        screen_height: u32,
        cell_width: u32,
        cell_height: u32,
        padding_top: u32,
        padding_bottom: u32,
        padding_right: u32,
        padding_left: u32,
    }

    #[repr(C)]
    struct GhosttySizeReportSize {
        rows: u16,
        columns: u16,
        cell_width: u32,
        cell_height: u32,
    }

    #[repr(C)]
    struct GhosttyDeviceAttributesPrimary {
        conformance_level: u16,
        features: [u16; 64],
        num_features: usize,
    }

    #[repr(C)]
    struct GhosttyDeviceAttributesSecondary {
        device_type: u16,
        firmware_version: u16,
        rom_cartridge: u16,
    }

    #[repr(C)]
    struct GhosttyDeviceAttributesTertiary {
        unit_id: u32,
    }

    #[repr(C)]
    struct GhosttyDeviceAttributes {
        primary: GhosttyDeviceAttributesPrimary,
        secondary: GhosttyDeviceAttributesSecondary,
        tertiary: GhosttyDeviceAttributesTertiary,
    }

    #[link(name = "ghostty-vt")]
    unsafe extern "C" {
        fn ghostty_terminal_new(
            allocator: *const GhosttyAllocator,
            terminal: *mut GhosttyTerminal,
            options: GhosttyTerminalOptions,
        ) -> GhosttyResult;
        fn ghostty_terminal_free(terminal: GhosttyTerminal);
        fn ghostty_terminal_resize(
            terminal: GhosttyTerminal,
            cols: u16,
            rows: u16,
            cell_width_px: u32,
            cell_height_px: u32,
        ) -> GhosttyResult;
        fn ghostty_terminal_set(
            terminal: GhosttyTerminal,
            option: c_int,
            value: *const c_void,
        ) -> GhosttyResult;
        fn ghostty_terminal_get(
            terminal: GhosttyTerminal,
            data: c_int,
            out: *mut c_void,
        ) -> GhosttyResult;
        fn ghostty_terminal_vt_write(terminal: GhosttyTerminal, data: *const u8, len: usize);
        fn ghostty_terminal_scroll_viewport(
            terminal: GhosttyTerminal,
            behavior: GhosttyTerminalScrollViewport,
        );
        fn ghostty_render_state_new(
            allocator: *const GhosttyAllocator,
            state: *mut GhosttyRenderState,
        ) -> GhosttyResult;
        fn ghostty_render_state_free(state: GhosttyRenderState);
        fn ghostty_render_state_update(
            state: GhosttyRenderState,
            terminal: GhosttyTerminal,
        ) -> GhosttyResult;
        fn ghostty_render_state_get(
            state: GhosttyRenderState,
            data: c_int,
            out: *mut c_void,
        ) -> GhosttyResult;
        fn ghostty_render_state_colors_get(
            state: GhosttyRenderState,
            out_colors: *mut GhosttyRenderStateColors,
        ) -> GhosttyResult;
        fn ghostty_render_state_row_iterator_new(
            allocator: *const GhosttyAllocator,
            out_iterator: *mut GhosttyRenderStateRowIterator,
        ) -> GhosttyResult;
        fn ghostty_render_state_row_iterator_free(iterator: GhosttyRenderStateRowIterator);
        fn ghostty_render_state_row_iterator_next(iterator: GhosttyRenderStateRowIterator) -> bool;
        fn ghostty_render_state_row_get(
            iterator: GhosttyRenderStateRowIterator,
            data: c_int,
            out: *mut c_void,
        ) -> GhosttyResult;
        fn ghostty_render_state_row_cells_new(
            allocator: *const GhosttyAllocator,
            out_cells: *mut GhosttyRenderStateRowCells,
        ) -> GhosttyResult;
        fn ghostty_render_state_row_cells_free(cells: GhosttyRenderStateRowCells);
        fn ghostty_render_state_row_cells_next(cells: GhosttyRenderStateRowCells) -> bool;
        fn ghostty_render_state_row_cells_get(
            cells: GhosttyRenderStateRowCells,
            data: c_int,
            out: *mut c_void,
        ) -> GhosttyResult;
        fn ghostty_key_encoder_new(
            allocator: *const GhosttyAllocator,
            encoder: *mut GhosttyKeyEncoder,
        ) -> GhosttyResult;
        fn ghostty_key_encoder_free(encoder: GhosttyKeyEncoder);
        fn ghostty_key_encoder_setopt_from_terminal(
            encoder: GhosttyKeyEncoder,
            terminal: GhosttyTerminal,
        );
        fn ghostty_key_encoder_encode(
            encoder: GhosttyKeyEncoder,
            event: GhosttyKeyEvent,
            out_buf: *mut c_char,
            out_buf_size: usize,
            out_len: *mut usize,
        ) -> GhosttyResult;
        fn ghostty_key_event_new(
            allocator: *const GhosttyAllocator,
            event: *mut GhosttyKeyEvent,
        ) -> GhosttyResult;
        fn ghostty_key_event_free(event: GhosttyKeyEvent);
        fn ghostty_key_event_set_action(event: GhosttyKeyEvent, action: c_int);
        fn ghostty_key_event_set_key(event: GhosttyKeyEvent, key: u32);
        fn ghostty_key_event_set_mods(event: GhosttyKeyEvent, mods: u16);
        fn ghostty_key_event_set_consumed_mods(event: GhosttyKeyEvent, consumed_mods: u16);
        fn ghostty_key_event_set_utf8(event: GhosttyKeyEvent, utf8: *const c_char, len: usize);
        fn ghostty_key_event_set_unshifted_codepoint(event: GhosttyKeyEvent, codepoint: u32);
        fn ghostty_mouse_encoder_new(
            allocator: *const GhosttyAllocator,
            encoder: *mut GhosttyMouseEncoder,
        ) -> GhosttyResult;
        fn ghostty_mouse_encoder_free(encoder: GhosttyMouseEncoder);
        fn ghostty_mouse_encoder_setopt(
            encoder: GhosttyMouseEncoder,
            option: c_int,
            value: *const c_void,
        );
        fn ghostty_mouse_encoder_setopt_from_terminal(
            encoder: GhosttyMouseEncoder,
            terminal: GhosttyTerminal,
        );
        fn ghostty_mouse_encoder_encode(
            encoder: GhosttyMouseEncoder,
            event: GhosttyMouseEvent,
            out_buf: *mut c_char,
            out_buf_size: usize,
            out_len: *mut usize,
        ) -> GhosttyResult;
        fn ghostty_mouse_event_new(
            allocator: *const GhosttyAllocator,
            event: *mut GhosttyMouseEvent,
        ) -> GhosttyResult;
        fn ghostty_mouse_event_free(event: GhosttyMouseEvent);
        fn ghostty_mouse_event_set_action(event: GhosttyMouseEvent, action: c_int);
        fn ghostty_mouse_event_set_button(event: GhosttyMouseEvent, button: c_int);
        fn ghostty_mouse_event_clear_button(event: GhosttyMouseEvent);
        fn ghostty_mouse_event_set_mods(event: GhosttyMouseEvent, mods: u16);
        fn ghostty_mouse_event_set_position(event: GhosttyMouseEvent, position: GhosttyMousePosition);
    }

    pub fn ghostty_vt_status() -> Result<GhosttyVtStatus, String> {
        let source_dir = option_env!("OTTO_CANVAS_LIBGHOSTTY_VT_SOURCE_DIR").map(ToOwned::to_owned);
        let lib_dir = option_env!("OTTO_CANVAS_LIBGHOSTTY_VT_LIB_DIR").map(ToOwned::to_owned);

        Ok(GhosttyVtStatus {
            available: true,
            message: match (&source_dir, &lib_dir) {
                (Some(source_dir), _) => format!(
                    "libghostty-vt prototype is enabled using Ghostty source at {source_dir}"
                ),
                (None, Some(lib_dir)) => format!(
                    "libghostty-vt prototype is enabled using a prebuilt library at {lib_dir}"
                ),
                _ => "libghostty-vt prototype is enabled".to_string(),
            },
            source_dir,
            lib_dir,
        })
    }

    pub fn ghostty_vt_create_session(
        app_handle: &AppHandle,
        manager: &GhosttyVtManager,
        session_id: &str,
        cwd: Option<&str>,
        command: Option<&str>,
        cols: Option<u16>,
        rows: Option<u16>,
    ) -> Result<(), String> {
        ghostty_vt_create_session_in_map(
            app_handle,
            &manager.inner,
            session_id,
            cwd,
            command,
            cols.unwrap_or(DEFAULT_COLS).max(1),
            rows.unwrap_or(DEFAULT_ROWS).max(1),
        )
    }

    pub fn ghostty_vt_resize_session(
        manager: &GhosttyVtManager,
        session_id: &str,
        cols: u16,
        rows: u16,
        cell_width_px: Option<u32>,
        cell_height_px: Option<u32>,
    ) -> Result<(), String> {
        ghostty_vt_resize_session_in_map(
            &manager.inner,
            session_id,
            cols.max(1),
            rows.max(1),
            cell_width_px.unwrap_or(DEFAULT_CELL_WIDTH_PX).max(1),
            cell_height_px.unwrap_or(DEFAULT_CELL_HEIGHT_PX).max(1),
        )
    }

    pub fn ghostty_vt_send_text(
        manager: &GhosttyVtManager,
        session_id: &str,
        text: &str,
    ) -> Result<(), String> {
        ghostty_vt_send_text_in_map(&manager.inner, session_id, text)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_input_key(
        manager: &GhosttyVtManager,
        session_id: &str,
        code: &str,
        key: &str,
        text: Option<&str>,
        ctrl: bool,
        alt: bool,
        shift: bool,
        meta: bool,
        repeat: bool,
    ) -> Result<(), String> {
        ghostty_vt_input_key_in_map(
            &manager.inner,
            session_id,
            code,
            key,
            text,
            ctrl,
            alt,
            shift,
            meta,
            repeat,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_input_key_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        code: &str,
        key: &str,
        text: Option<&str>,
        ctrl: bool,
        alt: bool,
        shift: bool,
        meta: bool,
        repeat: bool,
    ) -> Result<(), String> {
        let session = lookup_session(sessions, session_id)?;
        session.input_key(code, key, text, ctrl, alt, shift, meta, repeat)
    }

    pub fn ghostty_vt_scroll_viewport(
        manager: &GhosttyVtManager,
        session_id: &str,
        delta: i64,
    ) -> Result<(), String> {
        ghostty_vt_scroll_viewport_in_map(&manager.inner, session_id, delta)
    }

    pub fn ghostty_vt_snapshot_session(
        manager: &GhosttyVtManager,
        session_id: &str,
    ) -> Result<GhosttyVtSnapshot, String> {
        ghostty_vt_snapshot_session_in_map(&manager.inner, session_id)
    }

    pub fn ghostty_vt_destroy_session(
        manager: &GhosttyVtManager,
        session_id: &str,
    ) -> Result<(), String> {
        ghostty_vt_destroy_session_in_map(&manager.inner, session_id)
    }

    pub fn ghostty_vt_create_session_in_map(
        app_handle: &AppHandle,
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        cwd: Option<&str>,
        command: Option<&str>,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let mut sessions = sessions
            .lock()
            .map_err(|_| "Failed to lock libghostty-vt session map".to_string())?;
        if sessions.contains_key(session_id) {
            return Ok(());
        }

        let session = GhosttyVtSession::spawn(app_handle.clone(), session_id, cwd, command, cols, rows)?;
        sessions.insert(session_id.to_string(), session);
        Ok(())
    }

    pub fn ghostty_vt_resize_session_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        cols: u16,
        rows: u16,
        cell_width_px: u32,
        cell_height_px: u32,
    ) -> Result<(), String> {
        let session = lookup_session(sessions, session_id)?;
        session.resize(cols, rows, cell_width_px, cell_height_px)
    }

    pub fn ghostty_vt_send_text_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        text: &str,
    ) -> Result<(), String> {
        let session = lookup_session(sessions, session_id)?;
        session.send_text(text)
    }

    pub fn ghostty_vt_scroll_viewport_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        delta: i64,
    ) -> Result<(), String> {
        let session = lookup_session(sessions, session_id)?;
        session.scroll_viewport(delta)
    }

    pub fn ghostty_vt_snapshot_session_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
    ) -> Result<GhosttyVtSnapshot, String> {
        let session = lookup_session(sessions, session_id)?;
        session.snapshot()
    }

    pub fn ghostty_vt_destroy_session_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
    ) -> Result<(), String> {
        let session = {
            let mut sessions = sessions
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt session map".to_string())?;
            sessions.remove(session_id)
        };

        if let Some(session) = session {
            session.stop()?;
        }

        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_mouse_button_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        x_px: f64,
        y_px: f64,
        width_px: f64,
        height_px: f64,
        button: u8,
        pressed: bool,
        mods: u16,
    ) -> Result<bool, String> {
        let session = lookup_session(sessions, session_id)?;
        session.mouse_button(x_px, y_px, width_px, height_px, button, pressed, mods)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_mouse_motion_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        x_px: f64,
        y_px: f64,
        width_px: f64,
        height_px: f64,
        pressed_button: Option<u8>,
        mods: u16,
    ) -> Result<bool, String> {
        let session = lookup_session(sessions, session_id)?;
        session.mouse_motion(x_px, y_px, width_px, height_px, pressed_button, mods)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn ghostty_vt_mouse_scroll_in_map(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
        x_px: f64,
        y_px: f64,
        width_px: f64,
        height_px: f64,
        delta_y: f64,
        precise: bool,
        mods: u16,
    ) -> Result<(), String> {
        let session = lookup_session(sessions, session_id)?;
        session.mouse_scroll(x_px, y_px, width_px, height_px, delta_y, precise, mods)
    }

    fn lookup_session(
        sessions: &Arc<Mutex<HashMap<String, Arc<SessionHandle>>>>,
        session_id: &str,
    ) -> Result<Arc<GhosttyVtSession>, String> {
        let sessions = sessions
            .lock()
            .map_err(|_| "Failed to lock libghostty-vt session map".to_string())?;
        sessions
            .get(session_id)
            .cloned()
            .ok_or_else(|| format!("libghostty-vt session {session_id} was not found"))
    }

    pub(super) type SessionHandle = GhosttyVtSession;

    pub(super) struct GhosttyVtSession {
        app_handle: AppHandle,
        session_id: String,
        terminal: Mutex<TerminalState>,
        geometry: Arc<Mutex<SessionGeometry>>,
        #[allow(dead_code)]
        callbacks: Box<CallbackContext>,
        reader_thread: Mutex<Option<JoinHandle<()>>>,
        pty_fd: AtomicI32,
        child_pid: libc::pid_t,
        process_alive: AtomicBool,
        child_reaped: AtomicBool,
        exit_status: AtomicI32,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct GhosttyVtUpdatedEvent {
        session_id: String,
    }

    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct GhosttyVtCloseEvent {
        block_id: String,
    }

    struct TerminalState {
        handle: GhosttyTerminal,
        render_state: GhosttyRenderState,
        key_encoder: GhosttyKeyEncoder,
        key_event: GhosttyKeyEvent,
        mouse_encoder: GhosttyMouseEncoder,
        mouse_event: GhosttyMouseEvent,
    }

    unsafe impl Send for TerminalState {}

    impl Drop for TerminalState {
        fn drop(&mut self) {
            unsafe {
                if !self.key_event.is_null() {
                    ghostty_key_event_free(self.key_event);
                }
                if !self.key_encoder.is_null() {
                    ghostty_key_encoder_free(self.key_encoder);
                }
                if !self.mouse_event.is_null() {
                    ghostty_mouse_event_free(self.mouse_event);
                }
                if !self.mouse_encoder.is_null() {
                    ghostty_mouse_encoder_free(self.mouse_encoder);
                }
                if !self.render_state.is_null() {
                    ghostty_render_state_free(self.render_state);
                }
                if !self.handle.is_null() {
                    ghostty_terminal_free(self.handle);
                }
            }
        }
    }

    #[derive(Clone, Copy)]
    struct SessionGeometry {
        cols: u16,
        rows: u16,
        cell_width_px: u32,
        cell_height_px: u32,
    }

    struct CallbackContext {
        pty_fd: RawFd,
        geometry: Arc<Mutex<SessionGeometry>>,
    }

    unsafe extern "C" fn write_pty_callback(
        _terminal: GhosttyTerminal,
        userdata: *mut c_void,
        data: *const u8,
        len: usize,
    ) {
        if userdata.is_null() || data.is_null() || len == 0 {
            return;
        }

        let context = unsafe { &*(userdata.cast::<CallbackContext>()) };
        let bytes = unsafe { slice::from_raw_parts(data, len) };
        write_best_effort(context.pty_fd, bytes);
    }

    unsafe extern "C" fn size_callback(
        _terminal: GhosttyTerminal,
        userdata: *mut c_void,
        out_size: *mut GhosttySizeReportSize,
    ) -> bool {
        if userdata.is_null() || out_size.is_null() {
            return false;
        }

        let context = unsafe { &*(userdata.cast::<CallbackContext>()) };
        let Ok(geometry) = context.geometry.lock() else {
            return false;
        };
        unsafe {
            (*out_size).rows = geometry.rows;
            (*out_size).columns = geometry.cols;
            (*out_size).cell_width = geometry.cell_width_px;
            (*out_size).cell_height = geometry.cell_height_px;
        }
        true
    }

    unsafe extern "C" fn device_attributes_callback(
        _terminal: GhosttyTerminal,
        _userdata: *mut c_void,
        out_attrs: *mut GhosttyDeviceAttributes,
    ) -> bool {
        if out_attrs.is_null() {
            return false;
        }

        unsafe {
            (*out_attrs).primary.conformance_level = 62;
            (*out_attrs).primary.features[0] = 1;
            (*out_attrs).primary.features[1] = 6;
            (*out_attrs).primary.features[2] = 22;
            (*out_attrs).primary.num_features = 3;
            (*out_attrs).secondary.device_type = 1;
            (*out_attrs).secondary.firmware_version = 1;
            (*out_attrs).secondary.rom_cartridge = 0;
            (*out_attrs).tertiary.unit_id = 0;
        }

        true
    }

    unsafe extern "C" fn xtversion_callback(
        _terminal: GhosttyTerminal,
        _userdata: *mut c_void,
    ) -> GhosttyString {
        GhosttyString {
            ptr: XTVERSION.as_ptr(),
            len: XTVERSION.len(),
        }
    }

    impl GhosttyVtSession {
        fn spawn(
            app_handle: AppHandle,
            session_id: &str,
            cwd: Option<&str>,
            command: Option<&str>,
            cols: u16,
            rows: u16,
        ) -> Result<Arc<Self>, String> {
            let geometry = Arc::new(Mutex::new(SessionGeometry {
                cols,
                rows,
                cell_width_px: DEFAULT_CELL_WIDTH_PX,
                cell_height_px: DEFAULT_CELL_HEIGHT_PX,
            }));
            let callbacks = Box::new(CallbackContext {
                pty_fd: -1,
                geometry: Arc::clone(&geometry),
            });

            let (pty_fd, child_pid) = spawn_shell(
                cwd,
                command,
                SessionGeometry {
                    cols,
                    rows,
                    cell_width_px: DEFAULT_CELL_WIDTH_PX,
                    cell_height_px: DEFAULT_CELL_HEIGHT_PX,
                },
            )?;

            let mut callbacks = callbacks;
            callbacks.pty_fd = pty_fd;

            let mut terminal = ptr::null_mut();
            let options = GhosttyTerminalOptions {
                cols,
                rows,
                max_scrollback: 5_000,
            };
            check_result(
                unsafe { ghostty_terminal_new(ptr::null(), &mut terminal, options) },
                "ghostty_terminal_new",
            )?;

            let userdata = (&*callbacks as *const CallbackContext)
                .cast_mut()
                .cast::<c_void>();
            check_result(
                unsafe {
                    ghostty_terminal_set(
                        terminal,
                        GHOSTTY_TERMINAL_OPT_USERDATA,
                        userdata.cast::<c_void>(),
                    )
                },
                "ghostty_terminal_set(USERDATA)",
            )?;
            check_result(
                unsafe {
                    ghostty_terminal_set(
                        terminal,
                        GHOSTTY_TERMINAL_OPT_WRITE_PTY,
                        (write_pty_callback as *const ()).cast(),
                    )
                },
                "ghostty_terminal_set(WRITE_PTY)",
            )?;
            check_result(
                unsafe {
                    ghostty_terminal_set(
                        terminal,
                        GHOSTTY_TERMINAL_OPT_SIZE,
                        (size_callback as *const ()).cast(),
                    )
                },
                "ghostty_terminal_set(SIZE)",
            )?;
            check_result(
                unsafe {
                    ghostty_terminal_set(
                        terminal,
                        GHOSTTY_TERMINAL_OPT_DEVICE_ATTRIBUTES,
                        (device_attributes_callback as *const ()).cast(),
                    )
                },
                "ghostty_terminal_set(DEVICE_ATTRIBUTES)",
            )?;
            check_result(
                unsafe {
                    ghostty_terminal_set(
                        terminal,
                        GHOSTTY_TERMINAL_OPT_XTVERSION,
                        (xtversion_callback as *const ()).cast(),
                    )
                },
                "ghostty_terminal_set(XTVERSION)",
            )?;
            check_result(
                unsafe {
                    ghostty_terminal_resize(
                        terminal,
                        cols,
                        rows,
                        DEFAULT_CELL_WIDTH_PX,
                        DEFAULT_CELL_HEIGHT_PX,
                    )
                },
                "ghostty_terminal_resize",
            )?;

            let mut render_state = ptr::null_mut();
            check_result(
                unsafe { ghostty_render_state_new(ptr::null(), &mut render_state) },
                "ghostty_render_state_new",
            )?;
            let mut key_encoder = ptr::null_mut();
            check_result(
                unsafe { ghostty_key_encoder_new(ptr::null(), &mut key_encoder) },
                "ghostty_key_encoder_new",
            )?;
            let mut key_event = ptr::null_mut();
            check_result(
                unsafe { ghostty_key_event_new(ptr::null(), &mut key_event) },
                "ghostty_key_event_new",
            )?;
            let mut mouse_encoder = ptr::null_mut();
            check_result(
                unsafe { ghostty_mouse_encoder_new(ptr::null(), &mut mouse_encoder) },
                "ghostty_mouse_encoder_new",
            )?;
            let mut mouse_event = ptr::null_mut();
            check_result(
                unsafe { ghostty_mouse_event_new(ptr::null(), &mut mouse_event) },
                "ghostty_mouse_event_new",
            )?;

            let session = Self {
                app_handle,
                session_id: session_id.to_string(),
                terminal: Mutex::new(TerminalState {
                    handle: terminal,
                    render_state,
                    key_encoder,
                    key_event,
                    mouse_encoder,
                    mouse_event,
                }),
                geometry,
                callbacks,
                reader_thread: Mutex::new(None),
                pty_fd: AtomicI32::new(pty_fd),
                child_pid,
                process_alive: AtomicBool::new(true),
                child_reaped: AtomicBool::new(false),
                exit_status: AtomicI32::new(EXIT_STATUS_RUNNING),
            };

            let session = Arc::new(session);
            let reader_session = Arc::clone(&session);
            let reader_thread = thread::Builder::new()
                .name(format!("ghostty-vt-{session_id}"))
                .spawn(move || reader_session.read_loop())
                .map_err(|error| format!("Failed to spawn libghostty-vt reader thread: {error}"))?;

            session
                .reader_thread
                .lock()
                .map_err(|_| "Failed to store libghostty-vt reader thread".to_string())?
                .replace(reader_thread);

            Ok(session)
        }

        fn read_loop(self: Arc<Self>) {
            let mut buffer = [0_u8; 4096];

            loop {
                let fd = self.pty_fd.load(Ordering::SeqCst);
                if fd < 0 {
                    break;
                }

                let read = unsafe { libc::read(fd, buffer.as_mut_ptr().cast(), buffer.len()) };
                if read > 0 {
                    let Ok(terminal) = self.terminal.lock() else {
                        break;
                    };
                    unsafe {
                        ghostty_terminal_vt_write(terminal.handle, buffer.as_ptr(), read as usize);
                    }
                    self.emit_updated();
                    continue;
                }

                if read == 0 {
                    break;
                }

                let error = io::Error::last_os_error();
                match error.raw_os_error() {
                    Some(code) if code == libc::EINTR => continue,
                    Some(code) if code == libc::EAGAIN || code == libc::EWOULDBLOCK => {
                        thread::sleep(std::time::Duration::from_millis(16));
                        continue;
                    }
                    Some(code) if code == libc::EIO || code == libc::EBADF => break,
                    _ => break,
                }
            }

            self.process_alive.store(false, Ordering::SeqCst);
            self.close_pty();
            self.reap_child(true);
            let _ = self.app_handle.emit(
                "ghostty-close-block",
                GhosttyVtCloseEvent {
                    block_id: self.session_id.clone(),
                },
            );
            self.emit_updated();
        }

        fn emit_updated(&self) {
            crate::native_terminal::request_redraw(&self.app_handle, &self.session_id);
            let _ = self.app_handle.emit(
                "ghostty-vt-updated",
                GhosttyVtUpdatedEvent {
                    session_id: self.session_id.clone(),
                },
            );
        }

        fn send_text(&self, text: &str) -> Result<(), String> {
            if text.is_empty() {
                return Ok(());
            }

            let fd = self.pty_fd.load(Ordering::SeqCst);
            if fd < 0 {
                return Err(format!(
                    "libghostty-vt session {} is no longer attached to a PTY",
                    self.session_id
                ));
            }

            write_best_effort(fd, text.as_bytes());
            Ok(())
        }

        #[allow(clippy::too_many_arguments)]
        fn input_key(
            &self,
            code: &str,
            key: &str,
            text: Option<&str>,
            ctrl: bool,
            alt: bool,
            shift: bool,
            meta: bool,
            repeat: bool,
        ) -> Result<(), String> {
            let ghostty_key = map_dom_code_to_ghostty_key(code);
            if ghostty_key == 0 {
                if let Some(text) = text.filter(|value| !value.is_empty()) {
                    if !ctrl && !meta {
                        return self.send_text(text);
                    }
                }
                return Ok(());
            }

            let terminal = self
                .terminal
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt terminal state".to_string())?;

            unsafe {
                ghostty_key_encoder_setopt_from_terminal(terminal.key_encoder, terminal.handle);
                ghostty_key_event_set_action(
                    terminal.key_event,
                    if repeat {
                        GHOSTTY_KEY_ACTION_REPEAT
                    } else {
                        GHOSTTY_KEY_ACTION_PRESS
                    },
                );
                ghostty_key_event_set_key(terminal.key_event, ghostty_key);
                ghostty_key_event_set_mods(
                    terminal.key_event,
                    mods_from_flags(ctrl, alt, shift, meta),
                );
                ghostty_key_event_set_consumed_mods(
                    terminal.key_event,
                    if shift && text.is_some() {
                        GHOSTTY_MODS_SHIFT
                    } else {
                        0
                    },
                );
            }

            let text = text.filter(|value| !value.is_empty() && !meta);
            let text_cstring = text.map(CString::new).transpose().map_err(|_| {
                "Keyboard event text contained a null byte for libghostty-vt".to_string()
            })?;
            unsafe {
                ghostty_key_event_set_utf8(
                    terminal.key_event,
                    text_cstring
                        .as_ref()
                        .map_or(ptr::null(), |value| value.as_ptr()),
                    text_cstring
                        .as_ref()
                        .map_or(0, |value| value.as_bytes().len()),
                );
                ghostty_key_event_set_unshifted_codepoint(
                    terminal.key_event,
                    unshifted_codepoint_from_dom(code, key),
                );
            }

            let mut buffer = vec![0_u8; 128];
            let mut written = 0;
            let result = unsafe {
                ghostty_key_encoder_encode(
                    terminal.key_encoder,
                    terminal.key_event,
                    buffer.as_mut_ptr().cast::<c_char>(),
                    buffer.len(),
                    &mut written,
                )
            };
            if result == GHOSTTY_SUCCESS && written > 0 {
                let fd = self.pty_fd.load(Ordering::SeqCst);
                if fd >= 0 {
                    write_best_effort(fd, &buffer[..written]);
                }
                return Ok(());
            }

            if let Some(text) = text {
                if !ctrl && !meta {
                    return self.send_text(text);
                }
            }

            check_result(result, "ghostty_key_encoder_encode")
        }

        fn scroll_viewport(&self, delta: i64) -> Result<(), String> {
            let terminal = self
                .terminal
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt terminal state".to_string())?;
            unsafe {
                ghostty_terminal_scroll_viewport(
                    terminal.handle,
                    GhosttyTerminalScrollViewport {
                        tag: GHOSTTY_SCROLL_VIEWPORT_DELTA,
                        value: GhosttyTerminalScrollViewportValue {
                            delta: delta as isize,
                        },
                    },
                );
            }
            self.emit_updated();
            Ok(())
        }

        fn encode_mouse_event(
            &self,
            action: i32,
            button: Option<i32>,
            any_button_pressed: bool,
            x_px: f64,
            y_px: f64,
            width_px: f64,
            height_px: f64,
            mods: u16,
        ) -> Result<bool, String> {
            let geometry = *self
                .geometry
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt session geometry".to_string())?;
            let terminal = self
                .terminal
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt terminal state".to_string())?;

            let mut mouse_tracking = false;
            let _ = unsafe {
                ghostty_terminal_get(
                    terminal.handle,
                    GHOSTTY_TERMINAL_DATA_MOUSE_TRACKING,
                    (&mut mouse_tracking as *mut bool).cast(),
                )
            };
            if !mouse_tracking {
                return Ok(false);
            }

            unsafe {
                ghostty_mouse_encoder_setopt_from_terminal(terminal.mouse_encoder, terminal.handle);
            }
            let enc_size = GhosttyMouseEncoderSize {
                size: mem::size_of::<GhosttyMouseEncoderSize>(),
                screen_width: width_px.max(1.0).round() as u32,
                screen_height: height_px.max(1.0).round() as u32,
                cell_width: geometry.cell_width_px.max(1),
                cell_height: geometry.cell_height_px.max(1),
                padding_top: 0,
                padding_bottom: 0,
                padding_right: 0,
                padding_left: 0,
            };
            let track_cell = true;
            unsafe {
                ghostty_mouse_encoder_setopt(
                    terminal.mouse_encoder,
                    GHOSTTY_MOUSE_ENCODER_OPT_SIZE,
                    (&enc_size as *const GhosttyMouseEncoderSize).cast(),
                );
                ghostty_mouse_encoder_setopt(
                    terminal.mouse_encoder,
                    GHOSTTY_MOUSE_ENCODER_OPT_ANY_BUTTON_PRESSED,
                    (&any_button_pressed as *const bool).cast(),
                );
                ghostty_mouse_encoder_setopt(
                    terminal.mouse_encoder,
                    GHOSTTY_MOUSE_ENCODER_OPT_TRACK_LAST_CELL,
                    (&track_cell as *const bool).cast(),
                );
                ghostty_mouse_event_set_mods(terminal.mouse_event, mods);
                ghostty_mouse_event_set_position(
                    terminal.mouse_event,
                    GhosttyMousePosition {
                        x: x_px as f32,
                        y: y_px as f32,
                    },
                );
                ghostty_mouse_event_set_action(terminal.mouse_event, action);
                match button {
                    Some(button) => ghostty_mouse_event_set_button(terminal.mouse_event, button),
                    None => ghostty_mouse_event_clear_button(terminal.mouse_event),
                }
            }

            let fd = self.pty_fd.load(Ordering::SeqCst);
            if fd < 0 {
                return Ok(true);
            }

            let mut buffer = [0_u8; 128];
            let mut written = 0;
            let result = unsafe {
                ghostty_mouse_encoder_encode(
                    terminal.mouse_encoder,
                    terminal.mouse_event,
                    buffer.as_mut_ptr().cast::<c_char>(),
                    buffer.len(),
                    &mut written,
                )
            };
            if result == GHOSTTY_SUCCESS && written > 0 {
                write_best_effort(fd, &buffer[..written]);
            }

            Ok(true)
        }

        #[allow(clippy::too_many_arguments)]
        fn mouse_button(
            &self,
            x_px: f64,
            y_px: f64,
            width_px: f64,
            height_px: f64,
            button: u8,
            pressed: bool,
            mods: u16,
        ) -> Result<bool, String> {
            let button = match button {
                1 => GHOSTTY_MOUSE_BUTTON_LEFT,
                2 => GHOSTTY_MOUSE_BUTTON_RIGHT,
                3 => GHOSTTY_MOUSE_BUTTON_MIDDLE,
                _ => GHOSTTY_MOUSE_BUTTON_UNKNOWN,
            };
            if button == GHOSTTY_MOUSE_BUTTON_UNKNOWN {
                return Ok(false);
            }
            self.encode_mouse_event(
                if pressed {
                    GHOSTTY_MOUSE_ACTION_PRESS
                } else {
                    GHOSTTY_MOUSE_ACTION_RELEASE
                },
                Some(button),
                pressed,
                x_px,
                y_px,
                width_px,
                height_px,
                mods,
            )
        }

        #[allow(clippy::too_many_arguments)]
        fn mouse_motion(
            &self,
            x_px: f64,
            y_px: f64,
            width_px: f64,
            height_px: f64,
            pressed_button: Option<u8>,
            mods: u16,
        ) -> Result<bool, String> {
            let button = match pressed_button {
                Some(1) => Some(GHOSTTY_MOUSE_BUTTON_LEFT),
                Some(2) => Some(GHOSTTY_MOUSE_BUTTON_RIGHT),
                Some(3) => Some(GHOSTTY_MOUSE_BUTTON_MIDDLE),
                Some(_) => Some(GHOSTTY_MOUSE_BUTTON_UNKNOWN),
                None => None,
            };
            self.encode_mouse_event(
                GHOSTTY_MOUSE_ACTION_MOTION,
                button.filter(|value| *value != GHOSTTY_MOUSE_BUTTON_UNKNOWN),
                pressed_button.is_some(),
                x_px,
                y_px,
                width_px,
                height_px,
                mods,
            )
        }

        fn mouse_scroll(
            &self,
            x_px: f64,
            y_px: f64,
            width_px: f64,
            height_px: f64,
            delta_y: f64,
            precise: bool,
            mods: u16,
        ) -> Result<(), String> {
            let geometry = *self
                .geometry
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt session geometry".to_string())?;
            let terminal = self
                .terminal
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt terminal state".to_string())?;

            let mut mouse_tracking = false;
            let _ = unsafe {
                ghostty_terminal_get(
                    terminal.handle,
                    GHOSTTY_TERMINAL_DATA_MOUSE_TRACKING,
                    (&mut mouse_tracking as *mut bool).cast(),
                )
            };

            let steps = scroll_steps_from_delta(delta_y, precise);
            if mouse_tracking {
                unsafe {
                    ghostty_mouse_encoder_setopt_from_terminal(terminal.mouse_encoder, terminal.handle);
                }
                let enc_size = GhosttyMouseEncoderSize {
                    size: mem::size_of::<GhosttyMouseEncoderSize>(),
                    screen_width: width_px.max(1.0).round() as u32,
                    screen_height: height_px.max(1.0).round() as u32,
                    cell_width: geometry.cell_width_px.max(1),
                    cell_height: geometry.cell_height_px.max(1),
                    padding_top: 0,
                    padding_bottom: 0,
                    padding_right: 0,
                    padding_left: 0,
                };
                let any_pressed = false;
                let track_cell = true;
                unsafe {
                    ghostty_mouse_encoder_setopt(
                        terminal.mouse_encoder,
                        GHOSTTY_MOUSE_ENCODER_OPT_SIZE,
                        (&enc_size as *const GhosttyMouseEncoderSize).cast(),
                    );
                    ghostty_mouse_encoder_setopt(
                        terminal.mouse_encoder,
                        GHOSTTY_MOUSE_ENCODER_OPT_ANY_BUTTON_PRESSED,
                        (&any_pressed as *const bool).cast(),
                    );
                    ghostty_mouse_encoder_setopt(
                        terminal.mouse_encoder,
                        GHOSTTY_MOUSE_ENCODER_OPT_TRACK_LAST_CELL,
                        (&track_cell as *const bool).cast(),
                    );
                    ghostty_mouse_event_set_mods(terminal.mouse_event, mods);
                    ghostty_mouse_event_set_position(
                        terminal.mouse_event,
                        GhosttyMousePosition {
                            x: x_px as f32,
                            y: y_px as f32,
                        },
                    );
                }

                let button = if delta_y > 0.0 {
                    GHOSTTY_MOUSE_BUTTON_FOUR
                } else {
                    GHOSTTY_MOUSE_BUTTON_FIVE
                };
                let fd = self.pty_fd.load(Ordering::SeqCst);
                if fd >= 0 {
                    for _ in 0..steps {
                        let mut buffer = [0_u8; 128];
                        let mut written = 0;
                        unsafe {
                            ghostty_mouse_event_set_button(terminal.mouse_event, button);
                            ghostty_mouse_event_set_action(
                                terminal.mouse_event,
                                GHOSTTY_MOUSE_ACTION_PRESS,
                            );
                        }
                        let press_result = unsafe {
                            ghostty_mouse_encoder_encode(
                                terminal.mouse_encoder,
                                terminal.mouse_event,
                                buffer.as_mut_ptr().cast::<c_char>(),
                                buffer.len(),
                                &mut written,
                            )
                        };
                        if press_result == GHOSTTY_SUCCESS && written > 0 {
                            write_best_effort(fd, &buffer[..written]);
                        }

                        written = 0;
                        unsafe {
                            ghostty_mouse_event_set_action(
                                terminal.mouse_event,
                                GHOSTTY_MOUSE_ACTION_RELEASE,
                            );
                        }
                        let release_result = unsafe {
                            ghostty_mouse_encoder_encode(
                                terminal.mouse_encoder,
                                terminal.mouse_event,
                                buffer.as_mut_ptr().cast::<c_char>(),
                                buffer.len(),
                                &mut written,
                            )
                        };
                        if release_result == GHOSTTY_SUCCESS && written > 0 {
                            write_best_effort(fd, &buffer[..written]);
                        }
                    }
                }
                return Ok(());
            }

            drop(terminal);
            self.scroll_viewport(if delta_y > 0.0 { -steps } else { steps })
        }

        fn resize(
            &self,
            cols: u16,
            rows: u16,
            cell_width_px: u32,
            cell_height_px: u32,
        ) -> Result<(), String> {
            {
                let mut geometry = self
                    .geometry
                    .lock()
                    .map_err(|_| "Failed to lock libghostty-vt session geometry".to_string())?;
                geometry.cols = cols;
                geometry.rows = rows;
                geometry.cell_width_px = cell_width_px;
                geometry.cell_height_px = cell_height_px;
            }

            let terminal = self
                .terminal
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt terminal state".to_string())?;
            check_result(
                unsafe {
                    ghostty_terminal_resize(
                        terminal.handle,
                        cols,
                        rows,
                        cell_width_px,
                        cell_height_px,
                    )
                },
                "ghostty_terminal_resize",
            )?;

            let fd = self.pty_fd.load(Ordering::SeqCst);
            if fd >= 0 {
                let winsize = libc::winsize {
                    ws_row: rows,
                    ws_col: cols,
                    ws_xpixel: cols.saturating_mul(cell_width_px as u16),
                    ws_ypixel: rows.saturating_mul(cell_height_px as u16),
                };
                unsafe {
                    libc::ioctl(fd, libc::TIOCSWINSZ, &winsize);
                }
            }

            Ok(())
        }

        fn snapshot(&self) -> Result<GhosttyVtSnapshot, String> {
            let geometry = *self
                .geometry
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt session geometry".to_string())?;
            let mut terminal = self
                .terminal
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt terminal state".to_string())?;

            let render_snapshot = render_terminal_snapshot(&mut terminal)?;
            let screen_text = plain_text_from_rows(&render_snapshot.rows_data);

            Ok(GhosttyVtSnapshot {
                session_id: self.session_id.clone(),
                cols: geometry.cols,
                rows: geometry.rows,
                screen_text,
                rows_data: render_snapshot.rows_data,
                default_fg: render_snapshot.default_fg,
                default_bg: render_snapshot.default_bg,
                ansi_palette: render_snapshot.ansi_palette,
                cursor: render_snapshot.cursor,
                process_alive: self.process_alive.load(Ordering::SeqCst),
                exit_status: self.exit_status(),
            })
        }

        fn stop(&self) -> Result<(), String> {
            if self.process_alive.swap(false, Ordering::SeqCst) {
                unsafe {
                    libc::kill(self.child_pid, libc::SIGHUP);
                }
            }
            self.close_pty();

            if let Some(handle) = self
                .reader_thread
                .lock()
                .map_err(|_| "Failed to lock libghostty-vt reader thread".to_string())?
                .take()
            {
                let _ = handle.join();
            }

            self.reap_child(true);
            self.emit_updated();
            Ok(())
        }

        fn close_pty(&self) {
            let fd = self.pty_fd.swap(-1, Ordering::SeqCst);
            if fd >= 0 {
                unsafe {
                    libc::close(fd);
                }
            }
        }

        fn exit_status(&self) -> Option<i32> {
            let exit_status = self.exit_status.load(Ordering::SeqCst);
            (exit_status != EXIT_STATUS_RUNNING).then_some(exit_status)
        }

        fn reap_child(&self, blocking: bool) {
            if self.child_reaped.load(Ordering::SeqCst) {
                return;
            }

            let mut status = 0;
            let wait_flags = if blocking { 0 } else { libc::WNOHANG };
            let wait_result = unsafe { libc::waitpid(self.child_pid, &mut status, wait_flags) };
            if wait_result != self.child_pid {
                return;
            }

            let exit_status = if libc::WIFEXITED(status) {
                libc::WEXITSTATUS(status)
            } else if libc::WIFSIGNALED(status) {
                128 + libc::WTERMSIG(status)
            } else {
                0
            };
            self.exit_status.store(exit_status, Ordering::SeqCst);
            self.child_reaped.store(true, Ordering::SeqCst);
        }
    }

    impl Drop for GhosttyVtSession {
        fn drop(&mut self) {
            self.close_pty();
        }
    }

    struct RenderSnapshotInternal {
        rows_data: Vec<GhosttyVtRow>,
        default_fg: GhosttyVtRgb,
        default_bg: GhosttyVtRgb,
        ansi_palette: Vec<GhosttyVtRgb>,
        cursor: GhosttyVtCursor,
    }

    fn render_terminal_snapshot(
        terminal: &mut TerminalState,
    ) -> Result<RenderSnapshotInternal, String> {
        let render_state = terminal.render_state;
        let mut row_iterator = ptr::null_mut();
        check_result(
            unsafe { ghostty_render_state_row_iterator_new(ptr::null(), &mut row_iterator) },
            "ghostty_render_state_row_iterator_new",
        )?;
        let mut row_cells = ptr::null_mut();
        check_result(
            unsafe { ghostty_render_state_row_cells_new(ptr::null(), &mut row_cells) },
            "ghostty_render_state_row_cells_new",
        )?;

        let result = (|| {
            check_result(
                unsafe { ghostty_render_state_update(render_state, terminal.handle) },
                "ghostty_render_state_update",
            )?;

            let mut colors = GhosttyRenderStateColors {
                size: mem::size_of::<GhosttyRenderStateColors>(),
                background: GhosttyColorRgb { r: 0, g: 0, b: 0 },
                foreground: GhosttyColorRgb {
                    r: 255,
                    g: 255,
                    b: 255,
                },
                cursor: GhosttyColorRgb { r: 0, g: 0, b: 0 },
                cursor_has_value: false,
                palette: [GhosttyColorRgb { r: 0, g: 0, b: 0 }; 256],
            };
            check_result(
                unsafe { ghostty_render_state_colors_get(render_state, &mut colors) },
                "ghostty_render_state_colors_get",
            )?;

            check_result(
                unsafe {
                    ghostty_render_state_get(
                        render_state,
                        GHOSTTY_RENDER_STATE_DATA_ROW_ITERATOR,
                        (&mut row_iterator as *mut GhosttyRenderStateRowIterator).cast(),
                    )
                },
                "ghostty_render_state_get(ROW_ITERATOR)",
            )?;

            let mut cursor_visible = false;
            let mut cursor_blinking = false;
            let mut cursor_has_value = false;
            let mut cursor_x = 0_u16;
            let mut cursor_y = 0_u16;
            let mut cursor_shape = 1_i32;
            let _ = unsafe {
                ghostty_render_state_get(
                    render_state,
                    GHOSTTY_RENDER_STATE_DATA_CURSOR_VISIBLE,
                    (&mut cursor_visible as *mut bool).cast(),
                )
            };
            let _ = unsafe {
                ghostty_render_state_get(
                    render_state,
                    GHOSTTY_RENDER_STATE_DATA_CURSOR_BLINKING,
                    (&mut cursor_blinking as *mut bool).cast(),
                )
            };
            let _ = unsafe {
                ghostty_render_state_get(
                    render_state,
                    GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_HAS_VALUE,
                    (&mut cursor_has_value as *mut bool).cast(),
                )
            };
            let _ = unsafe {
                ghostty_render_state_get(
                    render_state,
                    GHOSTTY_RENDER_STATE_DATA_CURSOR_VISUAL_STYLE,
                    (&mut cursor_shape as *mut i32).cast(),
                )
            };
            if cursor_has_value {
                let _ = unsafe {
                    ghostty_render_state_get(
                        render_state,
                        GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_X,
                        (&mut cursor_x as *mut u16).cast(),
                    )
                };
                let _ = unsafe {
                    ghostty_render_state_get(
                        render_state,
                        GHOSTTY_RENDER_STATE_DATA_CURSOR_VIEWPORT_Y,
                        (&mut cursor_y as *mut u16).cast(),
                    )
                };
            }

            let mut rows_data = Vec::new();
            while unsafe { ghostty_render_state_row_iterator_next(row_iterator) } {
                check_result(
                    unsafe {
                        ghostty_render_state_row_get(
                            row_iterator,
                            GHOSTTY_RENDER_STATE_ROW_DATA_CELLS,
                            (&mut row_cells as *mut GhosttyRenderStateRowCells).cast(),
                        )
                    },
                    "ghostty_render_state_row_get(CELLS)",
                )?;

                let mut cells = Vec::new();
                while unsafe { ghostty_render_state_row_cells_next(row_cells) } {
                    let mut grapheme_len = 0_u32;
                    let _ = unsafe {
                        ghostty_render_state_row_cells_get(
                            row_cells,
                            GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_LEN,
                            (&mut grapheme_len as *mut u32).cast(),
                        )
                    };

                    let text = if grapheme_len > 0 {
                        let mut codepoints = vec![0_u32; grapheme_len as usize];
                        let _ = unsafe {
                            ghostty_render_state_row_cells_get(
                                row_cells,
                                GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_GRAPHEMES_BUF,
                                codepoints.as_mut_ptr().cast(),
                            )
                        };
                        utf8_from_codepoints(&codepoints)
                    } else {
                        String::new()
                    };

                    let mut fg_rgb = GhosttyColorRgb { r: 0, g: 0, b: 0 };
                    let fg = (unsafe {
                        ghostty_render_state_row_cells_get(
                            row_cells,
                            GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_FG_COLOR,
                            (&mut fg_rgb as *mut GhosttyColorRgb).cast(),
                        )
                    } == GHOSTTY_SUCCESS)
                        .then(|| serialize_rgb(fg_rgb));

                    let mut bg_rgb = GhosttyColorRgb { r: 0, g: 0, b: 0 };
                    let bg = (unsafe {
                        ghostty_render_state_row_cells_get(
                            row_cells,
                            GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_BG_COLOR,
                            (&mut bg_rgb as *mut GhosttyColorRgb).cast(),
                        )
                    } == GHOSTTY_SUCCESS)
                        .then(|| serialize_rgb(bg_rgb));

                    let mut style = default_style();
                    let _ = unsafe {
                        ghostty_render_state_row_cells_get(
                            row_cells,
                            GHOSTTY_RENDER_STATE_ROW_CELLS_DATA_STYLE,
                            (&mut style as *mut GhosttyStyle).cast(),
                        )
                    };

                    cells.push(GhosttyVtCell {
                        text,
                        fg,
                        bg,
                        bold: style.bold,
                        italic: style.italic,
                        dim: style.faint,
                        underline: style.underline != 0,
                        strikethrough: style.strikethrough,
                        invisible: style.invisible,
                    });
                }

                rows_data.push(GhosttyVtRow { cells });
            }

            Ok(RenderSnapshotInternal {
                rows_data,
                default_fg: serialize_rgb(colors.foreground),
                default_bg: serialize_rgb(colors.background),
                ansi_palette: colors
                    .palette
                    .iter()
                    .take(16)
                    .copied()
                    .map(serialize_rgb)
                    .collect(),
                cursor: GhosttyVtCursor {
                    visible: cursor_visible && cursor_has_value,
                    blinking: cursor_blinking,
                    x: cursor_has_value.then_some(cursor_x),
                    y: cursor_has_value.then_some(cursor_y),
                    shape: cursor_shape_name(cursor_shape).to_string(),
                },
            })
        })();

        unsafe {
            ghostty_render_state_row_cells_free(row_cells);
            ghostty_render_state_row_iterator_free(row_iterator);
        }

        result
    }

    fn plain_text_from_rows(rows: &[GhosttyVtRow]) -> String {
        let mut output = String::new();
        for (row_index, row) in rows.iter().enumerate() {
            let mut line = String::new();
            for cell in &row.cells {
                line.push_str(if cell.invisible { " " } else { &cell.text });
            }
            while line.ends_with(' ') {
                line.pop();
            }
            output.push_str(&line);
            if row_index + 1 < rows.len() {
                output.push('\n');
            }
        }
        output
    }

    fn default_style() -> GhosttyStyle {
        GhosttyStyle {
            size: mem::size_of::<GhosttyStyle>(),
            fg_color: GhosttyStyleColor {
                tag: 0,
                value: [0; 8],
            },
            bg_color: GhosttyStyleColor {
                tag: 0,
                value: [0; 8],
            },
            underline_color: GhosttyStyleColor {
                tag: 0,
                value: [0; 8],
            },
            bold: false,
            italic: false,
            faint: false,
            blink: false,
            inverse: false,
            invisible: false,
            strikethrough: false,
            overline: false,
            underline: 0,
        }
    }

    fn serialize_rgb(color: GhosttyColorRgb) -> GhosttyVtRgb {
        GhosttyVtRgb {
            r: color.r,
            g: color.g,
            b: color.b,
        }
    }

    fn utf8_from_codepoints(codepoints: &[u32]) -> String {
        codepoints
            .iter()
            .map(|value| char::from_u32(*value).unwrap_or(char::REPLACEMENT_CHARACTER))
            .collect()
    }

    fn scroll_steps_from_delta(delta_y: f64, precise: bool) -> i64 {
        let magnitude = delta_y.abs();
        let steps = if precise {
            (magnitude / 10.0).round() as i64
        } else {
            magnitude.round() as i64
        };
        steps.max(1)
    }

    fn cursor_shape_name(shape: i32) -> &'static str {
        match shape {
            0 => "bar",
            2 => "underline",
            3 => "hollow-block",
            _ => "block",
        }
    }

    fn mods_from_flags(ctrl: bool, alt: bool, shift: bool, meta: bool) -> u16 {
        let mut mods = 0;
        if shift {
            mods |= GHOSTTY_MODS_SHIFT;
        }
        if ctrl {
            mods |= GHOSTTY_MODS_CTRL;
        }
        if alt {
            mods |= GHOSTTY_MODS_ALT;
        }
        if meta {
            mods |= GHOSTTY_MODS_SUPER;
        }
        mods
    }

    fn unshifted_codepoint_from_dom(code: &str, key: &str) -> u32 {
        match code {
            "Backquote" => '`' as u32,
            "Backslash" => '\\' as u32,
            "BracketLeft" => '[' as u32,
            "BracketRight" => ']' as u32,
            "Comma" => ',' as u32,
            "Digit0" => '0' as u32,
            "Digit1" => '1' as u32,
            "Digit2" => '2' as u32,
            "Digit3" => '3' as u32,
            "Digit4" => '4' as u32,
            "Digit5" => '5' as u32,
            "Digit6" => '6' as u32,
            "Digit7" => '7' as u32,
            "Digit8" => '8' as u32,
            "Digit9" => '9' as u32,
            "Equal" => '=' as u32,
            "Minus" => '-' as u32,
            "Period" => '.' as u32,
            "Quote" => '\'' as u32,
            "Semicolon" => ';' as u32,
            "Slash" => '/' as u32,
            "Space" => ' ' as u32,
            _ if code.starts_with("Key") => code
                .chars()
                .nth(3)
                .map(|value| value.to_ascii_lowercase() as u32)
                .unwrap_or(0),
            _ => key
                .chars()
                .next()
                .map(|value| value.to_ascii_lowercase() as u32)
                .unwrap_or(0),
        }
    }

    fn map_dom_code_to_ghostty_key(code: &str) -> u32 {
        match code {
            "Backquote" => 1,
            "Backslash" => 2,
            "BracketLeft" => 3,
            "BracketRight" => 4,
            "Comma" => 5,
            "Digit0" => 6,
            "Digit1" => 7,
            "Digit2" => 8,
            "Digit3" => 9,
            "Digit4" => 10,
            "Digit5" => 11,
            "Digit6" => 12,
            "Digit7" => 13,
            "Digit8" => 14,
            "Digit9" => 15,
            "Equal" => 16,
            "KeyA" => 20,
            "KeyB" => 21,
            "KeyC" => 22,
            "KeyD" => 23,
            "KeyE" => 24,
            "KeyF" => 25,
            "KeyG" => 26,
            "KeyH" => 27,
            "KeyI" => 28,
            "KeyJ" => 29,
            "KeyK" => 30,
            "KeyL" => 31,
            "KeyM" => 32,
            "KeyN" => 33,
            "KeyO" => 34,
            "KeyP" => 35,
            "KeyQ" => 36,
            "KeyR" => 37,
            "KeyS" => 38,
            "KeyT" => 39,
            "KeyU" => 40,
            "KeyV" => 41,
            "KeyW" => 42,
            "KeyX" => 43,
            "KeyY" => 44,
            "KeyZ" => 45,
            "Minus" => 46,
            "Period" => 47,
            "Quote" => 48,
            "Semicolon" => 49,
            "Slash" => 50,
            "AltLeft" => 51,
            "AltRight" => 52,
            "Backspace" => 53,
            "CapsLock" => 54,
            "ContextMenu" => 55,
            "ControlLeft" => 56,
            "ControlRight" => 57,
            "Enter" => 58,
            "MetaLeft" => 59,
            "MetaRight" => 60,
            "ShiftLeft" => 61,
            "ShiftRight" => 62,
            "Space" => 63,
            "Tab" => 64,
            "Delete" => 68,
            "End" => 69,
            "Home" => 71,
            "Insert" => 72,
            "PageDown" => 73,
            "PageUp" => 74,
            "ArrowDown" => 75,
            "ArrowLeft" => 76,
            "ArrowRight" => 77,
            "ArrowUp" => 78,
            "Escape" => 120,
            "F1" => 121,
            "F2" => 122,
            "F3" => 123,
            "F4" => 124,
            "F5" => 125,
            "F6" => 126,
            "F7" => 127,
            "F8" => 128,
            "F9" => 129,
            "F10" => 130,
            "F11" => 131,
            "F12" => 132,
            _ => 0,
        }
    }

    fn check_result(result: GhosttyResult, op: &str) -> Result<(), String> {
        if result == GHOSTTY_SUCCESS {
            Ok(())
        } else {
            Err(format!(
                "{op} failed with libghostty-vt error code {result}"
            ))
        }
    }

    fn write_best_effort(fd: RawFd, bytes: &[u8]) {
        let mut remaining = bytes;
        while !remaining.is_empty() {
            let written =
                unsafe { libc::write(fd, remaining.as_ptr().cast::<c_void>(), remaining.len()) };
            if written > 0 {
                remaining = &remaining[written as usize..];
                continue;
            }

            let error = io::Error::last_os_error();
            match error.raw_os_error() {
                Some(code) if code == libc::EINTR => continue,
                _ => break,
            }
        }
    }

    fn spawn_shell(
        cwd: Option<&str>,
        command: Option<&str>,
        geometry: SessionGeometry,
    ) -> Result<(RawFd, libc::pid_t), String> {
        let mut pty_fd = -1;
        let mut winsize = libc::winsize {
            ws_row: geometry.rows,
            ws_col: geometry.cols,
            ws_xpixel: geometry.cols.saturating_mul(geometry.cell_width_px as u16),
            ws_ypixel: geometry.rows.saturating_mul(geometry.cell_height_px as u16),
        };

        let child_pid =
            unsafe { libc::forkpty(&mut pty_fd, ptr::null_mut(), ptr::null_mut(), &mut winsize) };
        if child_pid < 0 {
            return Err(format!("forkpty failed: {}", io::Error::last_os_error()));
        }

        if child_pid == 0 {
            run_shell_child(cwd, command);
        }

        let flags = unsafe { libc::fcntl(pty_fd, libc::F_GETFL) };
        if flags < 0 {
            unsafe {
                libc::close(pty_fd);
            }
            return Err(format!(
                "fcntl(F_GETFL) failed: {}",
                io::Error::last_os_error()
            ));
        }
        if unsafe { libc::fcntl(pty_fd, libc::F_SETFL, flags | libc::O_NONBLOCK) } < 0 {
            unsafe {
                libc::close(pty_fd);
            }
            return Err(format!(
                "fcntl(F_SETFL) failed: {}",
                io::Error::last_os_error()
            ));
        }

        Ok((pty_fd, child_pid))
    }

    fn run_shell_child(cwd: Option<&str>, command: Option<&str>) -> ! {
        if let Some(cwd) = cwd {
            if let Ok(cwd) = CString::new(cwd) {
                unsafe {
                    libc::chdir(cwd.as_ptr());
                }
            }
        }

        set_env("TERM", "xterm-256color");
        set_env("COLORTERM", "truecolor");

        if let Some(command) = command {
            let shell = CString::new("/bin/sh").expect("static shell path is valid");
            let arg0 = CString::new("sh").expect("static shell name is valid");
            let arg1 = CString::new("-lc").expect("static shell arg is valid");
            let command = CString::new(command)
                .unwrap_or_else(|_| CString::new("").expect("empty command is valid"));
            unsafe {
                libc::execl(
                    shell.as_ptr(),
                    arg0.as_ptr(),
                    arg1.as_ptr(),
                    command.as_ptr(),
                    ptr::null::<c_char>(),
                );
            }
        } else {
            let shell_path = std::env::var("SHELL")
                .ok()
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| "/bin/sh".to_string());
            let shell = CString::new(shell_path.clone())
                .unwrap_or_else(|_| CString::new("/bin/sh").expect("static shell path is valid"));
            let shell_name = Path::new(&shell_path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("sh");
            let shell_name = CString::new(shell_name)
                .unwrap_or_else(|_| CString::new("sh").expect("static shell name is valid"));
            unsafe {
                libc::execl(shell.as_ptr(), shell_name.as_ptr(), ptr::null::<c_char>());
            }
        }

        unsafe {
            libc::_exit(127);
        }
    }

    fn set_env(key: &str, value: &str) {
        let Ok(key) = CString::new(key) else {
            return;
        };
        let Ok(value) = CString::new(value) else {
            return;
        };
        unsafe {
            libc::setenv(key.as_ptr(), value.as_ptr(), 1);
        }
    }
}
