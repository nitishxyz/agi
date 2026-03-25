use serde::Serialize;
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
};
use tauri::{AppHandle, WebviewWindow, Wry};

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;
const DEFAULT_CELL_WIDTH_PX: u32 = 8;
const DEFAULT_CELL_HEIGHT_PX: u32 = 16;
const TERMINAL_FONT_SIZE: f64 = 13.0;
const TERMINAL_PADDING_X: f64 = 2.0;
const TERMINAL_PADDING_Y: f64 = 2.0;

#[derive(Clone, Default)]
pub struct NativeTerminalManager {
    inner: Arc<Mutex<NativeTerminalState>>,
}

#[derive(Default)]
struct NativeTerminalState {
    blocks: HashMap<String, NativeTerminalBlock>,
}

struct NativeTerminalBlock {
    host_view: usize,
    visible: Arc<AtomicBool>,
}

unsafe impl Send for NativeTerminalState {}
unsafe impl Send for NativeTerminalBlock {}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeTerminalStatus {
    pub available: bool,
    pub message: String,
    pub mode: String,
}

#[tauri::command]
pub fn native_terminal_status(
    manager: tauri::State<'_, NativeTerminalManager>,
) -> Result<NativeTerminalStatus, String> {
    #[cfg(target_os = "macos")]
    {
        let _ = manager;
        Ok(NativeTerminalStatus {
            available: true,
            message: "Native macOS terminal surface is enabled in prototype mode.".into(),
            mode: "native-prototype".into(),
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = manager;
        Ok(NativeTerminalStatus {
            available: false,
            message: "Native terminal surfaces are currently implemented for macOS only."
                .into(),
            mode: "unsupported".into(),
        })
    }
}

#[tauri::command]
pub fn native_terminal_create_block(
    app_handle: AppHandle<Wry>,
    manager: tauri::State<'_, NativeTerminalManager>,
    block_id: String,
    cwd: Option<String>,
    command: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let manager = manager.inner().inner.clone();
        let window = crate::ghostty::main_canvas_window(&app_handle)?;
        let app_handle_for_create = app_handle.clone();
        crate::ghostty::run_on_main_thread_sync(&app_handle, move || unsafe {
            macos::create_block_inner(
                &app_handle_for_create,
                &window,
                &manager,
                &block_id,
                cwd,
                command,
            )
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_handle, manager, block_id, cwd, command);
        Err("Native terminal surfaces are currently implemented for macOS only.".into())
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn native_terminal_update_block(
    app_handle: AppHandle<Wry>,
    manager: tauri::State<'_, NativeTerminalManager>,
    block_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    viewport_height: f64,
    focused: bool,
    hidden: Option<bool>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let manager = manager.inner().inner.clone();
        let window = crate::ghostty::main_canvas_window(&app_handle)?;
        let hidden_flag = hidden.unwrap_or(false);
        crate::ghostty::run_on_main_thread_sync(&app_handle, move || unsafe {
            macos::update_block_inner(
                &window,
                &manager,
                &block_id,
                x,
                y,
                width,
                height,
                viewport_height,
                focused,
                hidden_flag,
            )
        })
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
            focused,
            hidden,
        );
        Err("Native terminal surfaces are currently implemented for macOS only.".into())
    }
}

#[tauri::command]
pub fn native_terminal_destroy_block(
    app_handle: AppHandle<Wry>,
    manager: tauri::State<'_, NativeTerminalManager>,
    block_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let manager = manager.inner().inner.clone();
        crate::ghostty::run_on_main_thread_sync(&app_handle, move || unsafe {
            macos::destroy_block_inner(&manager, &block_id)
        })
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_handle, manager, block_id);
        Err("Native terminal surfaces are currently implemented for macOS only.".into())
    }
}

pub(crate) fn request_redraw(app_handle: &AppHandle<Wry>, block_id: &str) {
    #[cfg(target_os = "macos")]
    {
        macos::request_redraw(app_handle, block_id);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app_handle, block_id);
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use objc2::{define_class, msg_send, runtime::AnyObject, MainThreadOnly};
    use tauri::Manager;
    use objc2::rc::Retained;
    use objc2_app_kit::{
        NSBezierPath, NSColor, NSEvent, NSEventModifierFlags, NSFont,
        NSFontAttributeName, NSForegroundColorAttributeName, NSResponder,
        NSPasteboard, NSPasteboardTypeString, NSStringDrawing, NSView, NSWindowOrderingMode,
    };
    use objc2_core_foundation::CFURL;
    use objc2_core_text::{CTFontManagerRegisterFontsForURL, CTFontManagerScope};
    use objc2_foundation::{
        NSDictionary, MainThreadMarker, NSObjectProtocol, NSPoint, NSRect, NSSize, NSString,
    };
    use std::path::PathBuf;

    static VIEW_BLOCK_IDS: OnceLock<Mutex<HashMap<usize, String>>> = OnceLock::new();
    static BLOCK_VIEWS: OnceLock<Mutex<HashMap<String, usize>>> = OnceLock::new();
    static BLOCK_INTERACTIONS: OnceLock<Mutex<HashMap<String, InteractionState>>> = OnceLock::new();
    static NERD_FONT_FAMILY: OnceLock<String> = OnceLock::new();

    #[derive(Clone, Copy, Default)]
    struct CellPosition {
        col: u16,
        row: u16,
    }

    #[derive(Clone, Copy, Default)]
    struct InteractionState {
        selection_anchor: Option<CellPosition>,
        selection_focus: Option<CellPosition>,
        pressed_button: Option<u8>,
    }

    fn view_block_ids() -> &'static Mutex<HashMap<usize, String>> {
        VIEW_BLOCK_IDS.get_or_init(|| Mutex::new(HashMap::new()))
    }

    fn block_views() -> &'static Mutex<HashMap<String, usize>> {
        BLOCK_VIEWS.get_or_init(|| Mutex::new(HashMap::new()))
    }

    fn block_interactions() -> &'static Mutex<HashMap<String, InteractionState>> {
        BLOCK_INTERACTIONS.get_or_init(|| Mutex::new(HashMap::new()))
    }

    define_class!(
        #[unsafe(super = NSView)]
        #[thread_kind = MainThreadOnly]
        struct NativeTerminalHostView;

        unsafe impl NSObjectProtocol for NativeTerminalHostView {}

        impl NativeTerminalHostView {
            #[unsafe(method(acceptsFirstResponder))]
            fn accepts_first_responder(&self) -> bool {
                true
            }

            #[unsafe(method(acceptsFirstMouse:))]
            fn accepts_first_mouse(&self, _event: Option<&NSEvent>) -> bool {
                true
            }

            #[unsafe(method(isFlipped))]
            fn is_flipped(&self) -> bool {
                true
            }

            #[unsafe(method(becomeFirstResponder))]
            fn become_first_responder(&self) -> bool {
                unsafe { msg_send![super(self), becomeFirstResponder] }
            }

            #[unsafe(method(resignFirstResponder))]
            fn resign_first_responder(&self) -> bool {
                unsafe { msg_send![super(self), resignFirstResponder] }
            }

            #[unsafe(method(mouseDown:))]
            fn mouse_down(&self, event: &NSEvent) {
                if let Some(window) = self.window() {
                    let _ = window.makeFirstResponder(Some(self));
                }
                handle_mouse_button(self, event, 1, true);
            }

            #[unsafe(method(mouseUp:))]
            fn mouse_up(&self, event: &NSEvent) {
                handle_mouse_button(self, event, 1, false);
            }

            #[unsafe(method(mouseDragged:))]
            fn mouse_dragged(&self, event: &NSEvent) {
                handle_mouse_motion(self, event);
            }

            #[unsafe(method(rightMouseDown:))]
            fn right_mouse_down(&self, event: &NSEvent) {
                if let Some(window) = self.window() {
                    let _ = window.makeFirstResponder(Some(self));
                }
                handle_mouse_button(self, event, 2, true);
            }

            #[unsafe(method(rightMouseUp:))]
            fn right_mouse_up(&self, event: &NSEvent) {
                handle_mouse_button(self, event, 2, false);
            }

            #[unsafe(method(rightMouseDragged:))]
            fn right_mouse_dragged(&self, event: &NSEvent) {
                handle_mouse_motion(self, event);
            }

            #[unsafe(method(otherMouseDown:))]
            fn other_mouse_down(&self, event: &NSEvent) {
                if let Some(window) = self.window() {
                    let _ = window.makeFirstResponder(Some(self));
                }
                handle_mouse_button(self, event, 3, true);
            }

            #[unsafe(method(otherMouseUp:))]
            fn other_mouse_up(&self, event: &NSEvent) {
                handle_mouse_button(self, event, 3, false);
            }

            #[unsafe(method(otherMouseDragged:))]
            fn other_mouse_dragged(&self, event: &NSEvent) {
                handle_mouse_motion(self, event);
            }

            #[unsafe(method(scrollWheel:))]
            fn scroll_wheel(&self, event: &NSEvent) {
                let Some(block_id) = block_id_for_view(self) else {
                    return;
                };
                let point = self.convertPoint_fromView(event.locationInWindow(), None);
                let bounds = self.bounds();
                let _ = crate::ghostty_vt::mouse_scroll_registered_session(
                    &block_id,
                    point.x,
                    point.y,
                    bounds.size.width,
                    bounds.size.height,
                    event.scrollingDeltaY(),
                    event.hasPreciseScrollingDeltas(),
                    mods_from_event(event),
                );
            }

            #[unsafe(method(keyDown:))]
            fn key_down(&self, event: &NSEvent) {
                handle_key_down(self, event);
            }

            #[unsafe(method(copy:))]
            fn copy(&self, _sender: Option<&NSResponder>) {
                let _ = copy_selection_to_clipboard(self);
            }

            #[unsafe(method(paste:))]
            fn paste(&self, _sender: Option<&NSResponder>) {
                let _ = paste_from_clipboard(self);
            }

            #[unsafe(method(selectAll:))]
            fn select_all(&self, _sender: Option<&NSResponder>) {
                let _ = select_all(self);
            }

            #[unsafe(method(performKeyEquivalent:))]
            fn perform_key_equivalent(&self, event: &NSEvent) -> bool {
                perform_key_equivalent(self, event)
            }

            #[unsafe(method(drawRect:))]
            fn draw_rect(&self, _dirty_rect: NSRect) {
                draw_terminal_view(self);
            }
        }
    );

    impl NativeTerminalHostView {
        fn new(mtm: MainThreadMarker, frame: NSRect) -> Retained<Self> {
            unsafe { msg_send![Self::alloc(mtm), initWithFrame: frame] }
        }
    }

    fn block_id_for_view(view: &NativeTerminalHostView) -> Option<String> {
        view_block_ids()
            .lock()
            .ok()
            .and_then(|map| map.get(&(view as *const _ as usize)).cloned())
    }

    fn normalized_selection_range(
        anchor: CellPosition,
        focus: CellPosition,
    ) -> (CellPosition, CellPosition) {
        if (anchor.row, anchor.col) <= (focus.row, focus.col) {
            (anchor, focus)
        } else {
            (focus, anchor)
        }
    }

    fn selection_range_for_block(block_id: &str) -> Option<(CellPosition, CellPosition)> {
        let interactions = block_interactions().lock().ok()?;
        let state = interactions.get(block_id)?;
        Some(normalized_selection_range(
            state.selection_anchor?,
            state.selection_focus?,
        ))
    }

    fn cell_is_selected(
        selection: Option<(CellPosition, CellPosition)>,
        row: usize,
        col: usize,
    ) -> bool {
        let Some((start, end)) = selection else {
            return false;
        };
        let row = row as u16;
        let col = col as u16;
        if row < start.row || row > end.row {
            return false;
        }
        if start.row == end.row {
            return row == start.row && col >= start.col && col <= end.col;
        }
        if row == start.row {
            return col >= start.col;
        }
        if row == end.row {
            return col <= end.col;
        }
        true
    }

    fn selection_background_color(selection: crate::ghostty_vt::GhosttyVtRgb) -> Retained<NSColor> {
        NSColor::colorWithSRGBRed_green_blue_alpha(
            f64::from(selection.r) / 255.0,
            f64::from(selection.g) / 255.0,
            f64::from(selection.b) / 255.0,
            0.24,
        )
    }

    fn point_to_cell(snapshot: &crate::ghostty_vt::GhosttyVtSnapshot, point: NSPoint) -> CellPosition {
        let (_, cell_width, cell_height, _) = terminal_font_metrics();
        let max_col = snapshot.cols.saturating_sub(1);
        let max_row = snapshot.rows.saturating_sub(1);
        let col = (((point.x - TERMINAL_PADDING_X).max(0.0)) / cell_width).floor() as u16;
        let row = (((point.y - TERMINAL_PADDING_Y).max(0.0)) / cell_height).floor() as u16;
        CellPosition {
            col: col.min(max_col),
            row: row.min(max_row),
        }
    }

    fn selected_text(snapshot: &crate::ghostty_vt::GhosttyVtSnapshot, block_id: &str) -> Option<String> {
        let (start, end) = selection_range_for_block(block_id)?;
        let mut lines = Vec::new();
        for row_index in start.row..=end.row {
            let row = snapshot.rows_data.get(row_index as usize)?;
            let start_col = if row_index == start.row { start.col } else { 0 };
            let end_col = if row_index == end.row {
                end.col
            } else {
                row.cells.len().saturating_sub(1) as u16
            };
            let mut line = String::new();
            for col_index in start_col..=end_col {
                let Some(cell) = row.cells.get(col_index as usize) else {
                    continue;
                };
                if cell.invisible || cell.text.is_empty() {
                    line.push(' ');
                } else {
                    line.push_str(&cell.text);
                }
            }
            lines.push(line.trim_end_matches(' ').to_string());
        }
        Some(lines.join("\n"))
    }

    fn write_text_to_clipboard(text: &str) -> bool {
        let pasteboard = NSPasteboard::generalPasteboard();
        let _ = pasteboard.clearContents();
        let pasteboard_type = unsafe { NSPasteboardTypeString };
        pasteboard.setString_forType(&NSString::from_str(text), pasteboard_type)
    }

    fn copy_selection_to_clipboard(view: &NativeTerminalHostView) -> bool {
        let Some(block_id) = block_id_for_view(view) else {
            return false;
        };
        let Ok(snapshot) = crate::ghostty_vt::snapshot_registered_session(&block_id) else {
            return false;
        };
        let Some(text) = selected_text(&snapshot, &block_id) else {
            return false;
        };
        if text.is_empty() {
            return false;
        }
        write_text_to_clipboard(&text)
    }

    fn paste_from_clipboard(view: &NativeTerminalHostView) -> bool {
        let Some(block_id) = block_id_for_view(view) else {
            return false;
        };
        let pasteboard = NSPasteboard::generalPasteboard();
        let pasteboard_type = unsafe { NSPasteboardTypeString };
        let Some(text) = pasteboard.stringForType(pasteboard_type) else {
            return false;
        };
        let Some(value) = string_from_nsstring(&text) else {
            return false;
        };
        crate::ghostty_vt::send_text_registered_session(&block_id, &value).is_ok()
    }

    fn select_all(view: &NativeTerminalHostView) -> bool {
        let Some(block_id) = block_id_for_view(view) else {
            return false;
        };
        let Ok(snapshot) = crate::ghostty_vt::snapshot_registered_session(&block_id) else {
            return false;
        };
        let last_row = snapshot.rows.saturating_sub(1);
        let last_col = snapshot.cols.saturating_sub(1);
        if let Ok(mut interactions) = block_interactions().lock() {
            interactions.insert(
                block_id,
                InteractionState {
                    selection_anchor: Some(CellPosition { col: 0, row: 0 }),
                    selection_focus: Some(CellPosition {
                        col: last_col,
                        row: last_row,
                    }),
                    pressed_button: None,
                },
            );
        }
        view.setNeedsDisplay(true);
        true
    }

    fn perform_key_equivalent(view: &NativeTerminalHostView, event: &NSEvent) -> bool {
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
            Some("c") | Some("x") => copy_selection_to_clipboard(view),
            Some("v") => paste_from_clipboard(view),
            Some("a") => select_all(view),
            _ => false,
        }
    }

    fn dom_special_key(key_code: u16) -> Option<(&'static str, &'static str)> {
        match key_code {
            36 => Some(("Enter", "Enter")),
            48 => Some(("Tab", "Tab")),
            51 => Some(("Backspace", "Backspace")),
            53 => Some(("Escape", "Escape")),
            115 => Some(("Home", "Home")),
            116 => Some(("PageUp", "PageUp")),
            117 => Some(("Delete", "Delete")),
            119 => Some(("End", "End")),
            121 => Some(("PageDown", "PageDown")),
            123 => Some(("ArrowLeft", "ArrowLeft")),
            124 => Some(("ArrowRight", "ArrowRight")),
            125 => Some(("ArrowDown", "ArrowDown")),
            126 => Some(("ArrowUp", "ArrowUp")),
            _ => None,
        }
    }

    fn handle_key_down(view: &NativeTerminalHostView, event: &NSEvent) {
        let Some(block_id) = block_id_for_view(view) else {
            return;
        };
        let flags = event
            .modifierFlags()
            .intersection(NSEventModifierFlags::DeviceIndependentFlagsMask);

        if flags.contains(NSEventModifierFlags::Command) {
            let sequence = match event.keyCode() {
                51 => Some("\u{15}"),
                117 => Some("\u{0b}"),
                _ => None,
            };
            if let Some(sequence) = sequence {
                let _ = crate::ghostty_vt::send_text_registered_session(&block_id, sequence);
            }
            return;
        }

        if let Some((code, key)) = dom_special_key(event.keyCode()) {
            let _ = crate::ghostty_vt::input_key_registered_session(
                &block_id,
                code,
                key,
                None,
                flags.contains(NSEventModifierFlags::Control),
                flags.contains(NSEventModifierFlags::Option),
                flags.contains(NSEventModifierFlags::Shift),
                false,
                event.isARepeat(),
            );
            return;
        }

        if let Some(chars) = event.characters() {
            if let Some(text) = string_from_nsstring(&chars) {
                let _ = crate::ghostty_vt::send_text_registered_session(&block_id, &text);
            }
        }
    }

    fn handle_mouse_button(view: &NativeTerminalHostView, event: &NSEvent, button: u8, pressed: bool) {
        let Some(block_id) = block_id_for_view(view) else {
            return;
        };
        let point = view.convertPoint_fromView(event.locationInWindow(), None);
        let bounds = view.bounds();
        let handled = crate::ghostty_vt::mouse_button_registered_session(
            &block_id,
            point.x,
            point.y,
            bounds.size.width,
            bounds.size.height,
            button,
            pressed,
            mods_from_event(event),
        )
        .unwrap_or(false);

        if let Ok(mut interactions) = block_interactions().lock() {
            let state = interactions.entry(block_id.clone()).or_default();
            if handled {
                state.pressed_button = if pressed { Some(button) } else { None };
                if pressed {
                    state.selection_anchor = None;
                    state.selection_focus = None;
                }
                view.setNeedsDisplay(true);
                return;
            }

            if button != 1 {
                state.pressed_button = if pressed { Some(button) } else { None };
                return;
            }

            let Ok(snapshot) = crate::ghostty_vt::snapshot_registered_session(&block_id) else {
                state.pressed_button = if pressed { Some(button) } else { None };
                return;
            };
            let cell = point_to_cell(&snapshot, point);
            if pressed {
                state.selection_anchor = Some(cell);
                state.selection_focus = Some(cell);
                state.pressed_button = Some(button);
            } else {
                if state.selection_anchor.is_some() {
                    state.selection_focus = Some(cell);
                }
                state.pressed_button = None;
            }
        }

        view.setNeedsDisplay(true);
    }

    fn handle_mouse_motion(view: &NativeTerminalHostView, event: &NSEvent) {
        let Some(block_id) = block_id_for_view(view) else {
            return;
        };
        let pressed_button = block_interactions()
            .lock()
            .ok()
            .and_then(|map| map.get(&block_id).and_then(|state| state.pressed_button));
        let point = view.convertPoint_fromView(event.locationInWindow(), None);
        let bounds = view.bounds();
        let handled = crate::ghostty_vt::mouse_motion_registered_session(
            &block_id,
            point.x,
            point.y,
            bounds.size.width,
            bounds.size.height,
            pressed_button,
            mods_from_event(event),
        )
        .unwrap_or(false);
        if handled {
            return;
        }

        if pressed_button != Some(1) {
            return;
        }
        let Ok(snapshot) = crate::ghostty_vt::snapshot_registered_session(&block_id) else {
            return;
        };
        let cell = point_to_cell(&snapshot, point);
        if let Ok(mut interactions) = block_interactions().lock() {
            let state = interactions.entry(block_id).or_default();
            if state.selection_anchor.is_some() {
                state.selection_focus = Some(cell);
            }
        }
        view.setNeedsDisplay(true);
    }

    pub(super) fn request_redraw(app_handle: &AppHandle<Wry>, block_id: &str) {
        let host_view = block_views()
            .lock()
            .ok()
            .and_then(|map| map.get(block_id).copied());
        let Some(host_view) = host_view else {
            return;
        };
        let _ = app_handle.run_on_main_thread(move || unsafe {
            let view = &*(host_view as *const NativeTerminalHostView);
            view.setNeedsDisplay(true);
        });
    }

    fn native_font_paths(app_handle: &AppHandle<Wry>) -> Vec<PathBuf> {
        let font_files = [
            "JetBrainsMonoNerdFont-Regular.ttf",
            "JetBrainsMonoNerdFont-Bold.ttf",
            "JetBrainsMonoNerdFont-Italic.ttf",
            "JetBrainsMonoNerdFont-BoldItalic.ttf",
        ];
        let mut candidates = Vec::new();
        if let Ok(resource_dir) = app_handle.path().resource_dir() {
            for file in font_files {
                candidates.push(resource_dir.join("resources/fonts").join(file));
                candidates.push(resource_dir.join("fonts").join(file));
            }
        }
        if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
            for file in font_files {
                candidates.push(PathBuf::from(&manifest_dir).join("resources/fonts").join(file));
            }
        }
        candidates
    }

    fn ensure_native_font_registered(app_handle: &AppHandle<Wry>) {
        if NERD_FONT_FAMILY.get().is_some() {
            return;
        }

        let mut registered_any = false;
        for path in native_font_paths(app_handle) {
            if !path.exists() {
                continue;
            }
            let Some(url) = CFURL::from_file_path(&path) else {
                continue;
            };
            let mut error = std::ptr::null_mut();
            let registered = unsafe {
                CTFontManagerRegisterFontsForURL(&url, CTFontManagerScope::Process, &mut error)
            };
            registered_any |= registered;
        }

        if registered_any {
            let _ = NERD_FONT_FAMILY.set("JetBrainsMono NF".to_string());
        }
    }

    fn terminal_font(font_size: f64) -> Retained<NSFont> {
        let candidates = [
            NERD_FONT_FAMILY.get().map(String::as_str),
            Some("JetBrainsMono NF"),
            Some("JetBrainsMono Nerd Font"),
        ];
        for family in candidates.into_iter().flatten() {
            if let Some(font) = NSFont::fontWithName_size(&NSString::from_str(family), font_size) {
                return font;
            }
        }
        NSFont::userFixedPitchFontOfSize(font_size)
            .unwrap_or_else(|| NSFont::systemFontOfSize(font_size))
    }

    fn mods_from_event(event: &NSEvent) -> u16 {
        let flags = event.modifierFlags();
        let mut mods = 0_u16;
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

    fn make_font_attributes(
        font: &NSFont,
    ) -> Retained<NSDictionary<objc2_foundation::NSAttributedStringKey, AnyObject>> {
        let font_obj: &AnyObject = font;
        let keys = unsafe { [NSFontAttributeName] };
        NSDictionary::from_slices(&keys, &[font_obj])
    }

    fn terminal_font_metrics() -> (Retained<NSFont>, f64, f64, f64) {
        let font = terminal_font(TERMINAL_FONT_SIZE);
        let probe = NSString::from_str("M");
        let font_attrs = make_font_attributes(&font);
        let probe_size = unsafe { probe.sizeWithAttributes(Some(&font_attrs)) };
        let max_adv = font.maximumAdvancement();
        let line_height = probe_size.height.ceil().max(f64::from(DEFAULT_CELL_HEIGHT_PX));
        let cell_width = probe_size
            .width
            .max(max_adv.width)
            .ceil()
            .max(f64::from(DEFAULT_CELL_WIDTH_PX));
        let cell_height = (line_height + 2.0).max(f64::from(DEFAULT_CELL_HEIGHT_PX));
        let text_offset_y = ((cell_height - line_height) / 2.0).max(0.0);
        (font, cell_width, cell_height, text_offset_y)
    }

    #[derive(Clone, Copy)]
    struct OttoTerminalTheme {
        background: crate::ghostty_vt::GhosttyVtRgb,
        foreground: crate::ghostty_vt::GhosttyVtRgb,
        cursor: crate::ghostty_vt::GhosttyVtRgb,
        selection: crate::ghostty_vt::GhosttyVtRgb,
        ansi_palette: [crate::ghostty_vt::GhosttyVtRgb; 16],
    }

    fn otto_terminal_theme() -> OttoTerminalTheme {
        OttoTerminalTheme {
            background: crate::ghostty_vt::GhosttyVtRgb { r: 6, g: 7, b: 8 },
            foreground: crate::ghostty_vt::GhosttyVtRgb {
                r: 216,
                g: 247,
                b: 255,
            },
            cursor: crate::ghostty_vt::GhosttyVtRgb {
                r: 100,
                g: 217,
                b: 255,
            },
            selection: crate::ghostty_vt::GhosttyVtRgb {
                r: 100,
                g: 217,
                b: 255,
            },
            ansi_palette: [
                crate::ghostty_vt::GhosttyVtRgb { r: 17, g: 19, b: 24 },
                crate::ghostty_vt::GhosttyVtRgb { r: 255, g: 122, b: 144 },
                crate::ghostty_vt::GhosttyVtRgb { r: 139, g: 212, b: 156 },
                crate::ghostty_vt::GhosttyVtRgb { r: 245, g: 200, b: 106 },
                crate::ghostty_vt::GhosttyVtRgb { r: 100, g: 217, b: 255 },
                crate::ghostty_vt::GhosttyVtRgb { r: 212, g: 165, b: 255 },
                crate::ghostty_vt::GhosttyVtRgb { r: 141, g: 232, b: 255 },
                crate::ghostty_vt::GhosttyVtRgb { r: 216, g: 247, b: 255 },
                crate::ghostty_vt::GhosttyVtRgb { r: 61, g: 68, b: 79 },
                crate::ghostty_vt::GhosttyVtRgb { r: 255, g: 150, b: 168 },
                crate::ghostty_vt::GhosttyVtRgb { r: 171, g: 231, b: 184 },
                crate::ghostty_vt::GhosttyVtRgb { r: 255, g: 220, b: 133 },
                crate::ghostty_vt::GhosttyVtRgb { r: 131, g: 226, b: 255 },
                crate::ghostty_vt::GhosttyVtRgb { r: 226, g: 190, b: 255 },
                crate::ghostty_vt::GhosttyVtRgb { r: 170, g: 241, b: 255 },
                crate::ghostty_vt::GhosttyVtRgb { r: 240, g: 251, b: 255 },
            ],
        }
    }

    fn apply_terminal_theme(
        color: crate::ghostty_vt::GhosttyVtRgb,
        default_fg: crate::ghostty_vt::GhosttyVtRgb,
        default_bg: crate::ghostty_vt::GhosttyVtRgb,
        ansi_palette: &[crate::ghostty_vt::GhosttyVtRgb],
        theme: OttoTerminalTheme,
    ) -> crate::ghostty_vt::GhosttyVtRgb {
        if color == default_bg {
            return theme.background;
        }
        if color == default_fg {
            return theme.foreground;
        }
        if let Some(index) = ansi_palette.iter().position(|candidate| *candidate == color) {
            if let Some(mapped) = theme.ansi_palette.get(index) {
                return *mapped;
            }
        }
        color
    }

    fn nscolor_from_rgb(rgb: &crate::ghostty_vt::GhosttyVtRgb) -> Retained<NSColor> {
        NSColor::colorWithSRGBRed_green_blue_alpha(
            f64::from(rgb.r) / 255.0,
            f64::from(rgb.g) / 255.0,
            f64::from(rgb.b) / 255.0,
            1.0,
        )
    }

    fn make_text_attributes(
        font: &NSFont,
        color: &NSColor,
    ) -> Retained<NSDictionary<objc2_foundation::NSAttributedStringKey, AnyObject>> {
        let font_obj: &AnyObject = font;
        let color_obj: &AnyObject = color;
        let keys = unsafe { [NSFontAttributeName, NSForegroundColorAttributeName] };
        NSDictionary::from_slices(&keys, &[font_obj, color_obj])
    }

    #[derive(Clone, Copy)]
    struct BranchSprite {
        up: bool,
        down: bool,
        left: bool,
        right: bool,
        filled: bool,
    }

    fn branch_sprite_for_char(ch: char) -> Option<BranchSprite> {
        match ch as u32 {
            0x0f5ee => Some(BranchSprite { up: false, down: false, left: false, right: false, filled: true }),
            0x0f5ef => Some(BranchSprite { up: false, down: false, left: false, right: false, filled: false }),
            0x0f5f0 => Some(BranchSprite { up: false, down: false, left: false, right: true, filled: true }),
            0x0f5f1 => Some(BranchSprite { up: false, down: false, left: false, right: true, filled: false }),
            0x0f5f2 => Some(BranchSprite { up: false, down: false, left: true, right: false, filled: true }),
            0x0f5f3 => Some(BranchSprite { up: false, down: false, left: true, right: false, filled: false }),
            0x0f5f4 => Some(BranchSprite { up: false, down: false, left: true, right: true, filled: true }),
            0x0f5f5 => Some(BranchSprite { up: false, down: false, left: true, right: true, filled: false }),
            0x0f5f6 => Some(BranchSprite { up: false, down: true, left: false, right: false, filled: true }),
            0x0f5f7 => Some(BranchSprite { up: false, down: true, left: false, right: false, filled: false }),
            0x0f5f8 => Some(BranchSprite { up: true, down: false, left: false, right: false, filled: true }),
            0x0f5f9 => Some(BranchSprite { up: true, down: false, left: false, right: false, filled: false }),
            0x0f5fa => Some(BranchSprite { up: true, down: true, left: false, right: false, filled: true }),
            0x0f5fb => Some(BranchSprite { up: true, down: true, left: false, right: false, filled: false }),
            0x0f5fc => Some(BranchSprite { up: false, down: true, left: false, right: true, filled: true }),
            0x0f5fd => Some(BranchSprite { up: false, down: true, left: false, right: true, filled: false }),
            0x0f5fe => Some(BranchSprite { up: false, down: true, left: true, right: false, filled: true }),
            0x0f5ff => Some(BranchSprite { up: false, down: true, left: true, right: false, filled: false }),
            0x0f600 => Some(BranchSprite { up: true, down: false, left: false, right: true, filled: true }),
            0x0f601 => Some(BranchSprite { up: true, down: false, left: false, right: true, filled: false }),
            0x0f602 => Some(BranchSprite { up: true, down: false, left: true, right: false, filled: true }),
            0x0f603 => Some(BranchSprite { up: true, down: false, left: true, right: false, filled: false }),
            0x0f604 => Some(BranchSprite { up: true, down: true, left: false, right: true, filled: true }),
            0x0f605 => Some(BranchSprite { up: true, down: true, left: false, right: true, filled: false }),
            0x0f606 => Some(BranchSprite { up: true, down: true, left: true, right: false, filled: true }),
            0x0f607 => Some(BranchSprite { up: true, down: true, left: true, right: false, filled: false }),
            0x0f608 => Some(BranchSprite { up: false, down: true, left: true, right: true, filled: true }),
            0x0f609 => Some(BranchSprite { up: false, down: true, left: true, right: true, filled: false }),
            0x0f60a => Some(BranchSprite { up: true, down: false, left: true, right: true, filled: true }),
            0x0f60b => Some(BranchSprite { up: true, down: false, left: true, right: true, filled: false }),
            0x0f60c => Some(BranchSprite { up: true, down: true, left: true, right: true, filled: true }),
            0x0f60d => Some(BranchSprite { up: true, down: true, left: true, right: true, filled: false }),
            _ => None,
        }
    }

    fn draw_branch_sprite(cell_rect: NSRect, sprite: BranchSprite, color: &NSColor) {
        let thick = ((cell_rect.size.width.min(cell_rect.size.height) / 8.0).round()).max(1.0);
        let h_top = ((cell_rect.size.height - thick) / 2.0).max(0.0);
        let v_left = ((cell_rect.size.width - thick) / 2.0).max(0.0);
        let cx = v_left + thick / 2.0;
        let cy = h_top + thick / 2.0;
        let r = cx.min(cy).min(cell_rect.size.width - cx).min(cell_rect.size.height - cy).max(thick / 2.0);

        color.setFill();
        if sprite.up {
            NSBezierPath::fillRect(NSRect::new(
                NSPoint::new(cell_rect.origin.x + v_left, cell_rect.origin.y),
                NSSize::new(thick, (cy - r + thick / 2.0).ceil().max(0.0)),
            ));
        }
        if sprite.right {
            NSBezierPath::fillRect(NSRect::new(
                NSPoint::new(cell_rect.origin.x + (cx + r - thick / 2.0).floor(), cell_rect.origin.y + h_top),
                NSSize::new((cell_rect.size.width - (cx + r - thick / 2.0).floor()).max(0.0), thick),
            ));
        }
        if sprite.down {
            NSBezierPath::fillRect(NSRect::new(
                NSPoint::new(cell_rect.origin.x + v_left, cell_rect.origin.y + (cy + r - thick / 2.0).floor()),
                NSSize::new(thick, (cell_rect.size.height - (cy + r - thick / 2.0).floor()).max(0.0)),
            ));
        }
        if sprite.left {
            NSBezierPath::fillRect(NSRect::new(
                NSPoint::new(cell_rect.origin.x, cell_rect.origin.y + h_top),
                NSSize::new((cx - r + thick / 2.0).ceil().max(0.0), thick),
            ));
        }

        let circle_rect = NSRect::new(
            NSPoint::new(cell_rect.origin.x + cx - r, cell_rect.origin.y + cy - r),
            NSSize::new(r * 2.0, r * 2.0),
        );
        let circle = NSBezierPath::bezierPathWithOvalInRect(circle_rect);
        if sprite.filled {
            circle.fill();
        } else {
            circle.setLineWidth(thick);
            circle.stroke();
        }
    }

    fn draw_terminal_view(view: &NativeTerminalHostView) {
        let bounds = view.bounds();
        let block_id = match block_id_for_view(view) {
            Some(value) => value,
            None => return,
        };

        let snapshot = crate::ghostty_vt::snapshot_registered_session(&block_id).ok();
        let theme = otto_terminal_theme();
        let default_bg = snapshot
            .as_ref()
            .map(|snap| snap.default_bg)
            .unwrap_or(theme.background);
        let default_fg = snapshot
            .as_ref()
            .map(|snap| snap.default_fg)
            .unwrap_or(theme.foreground);
        let ansi_palette = snapshot
            .as_ref()
            .map(|snap| snap.ansi_palette.clone())
            .unwrap_or_else(|| theme.ansi_palette.to_vec());
        let themed_default_bg = apply_terminal_theme(
            default_bg,
            default_fg,
            default_bg,
            &ansi_palette,
            theme,
        );

        let bg = nscolor_from_rgb(&themed_default_bg);
        bg.setFill();
        NSBezierPath::fillRect(bounds);

        let Some(snapshot) = snapshot else {
            return;
        };

        let (font, cell_width, cell_height, baseline_offset) = terminal_font_metrics();
        let origin_x = TERMINAL_PADDING_X;
        let origin_y = TERMINAL_PADDING_Y;
        let selection = selection_range_for_block(&block_id);
        let selection_bg = selection_background_color(theme.selection);

        for (row_index, row) in snapshot.rows_data.iter().enumerate() {
            for (cell_index, cell) in row.cells.iter().enumerate() {
                let cell_x = origin_x + cell_index as f64 * cell_width;
                let cell_y = origin_y + row_index as f64 * cell_height;
                let cell_rect = NSRect::new(
                    NSPoint::new(cell_x, cell_y),
                    NSSize::new(cell_width.ceil().max(1.0), cell_height.ceil().max(1.0)),
                );

                let is_cursor = snapshot.cursor.visible
                    && snapshot.cursor.x == Some(cell_index as u16)
                    && snapshot.cursor.y == Some(row_index as u16);

                let mut fg_rgb = apply_terminal_theme(
                    cell.fg.unwrap_or(default_fg),
                    default_fg,
                    default_bg,
                    &ansi_palette,
                    theme,
                );
                let mut bg_rgb = apply_terminal_theme(
                    cell.bg.unwrap_or(default_bg),
                    default_fg,
                    default_bg,
                    &ansi_palette,
                    theme,
                );

                if is_cursor && snapshot.cursor.shape == "block" {
                    std::mem::swap(&mut fg_rgb, &mut bg_rgb);
                }

                let bg_color = nscolor_from_rgb(&bg_rgb);
                if cell.bg.is_some() || (is_cursor && snapshot.cursor.shape == "block") {
                    bg_color.setFill();
                    NSBezierPath::fillRect(cell_rect);
                }
                if cell_is_selected(selection, row_index, cell_index) {
                    selection_bg.setFill();
                    NSBezierPath::fillRect(cell_rect);
                }
            }

            for (cell_index, cell) in row.cells.iter().enumerate() {
                let cell_x = origin_x + cell_index as f64 * cell_width;
                let cell_y = origin_y + row_index as f64 * cell_height;
                let cell_rect = NSRect::new(
                    NSPoint::new(cell_x, cell_y),
                    NSSize::new(cell_width.ceil().max(1.0), cell_height.ceil().max(1.0)),
                );

                let is_cursor = snapshot.cursor.visible
                    && snapshot.cursor.x == Some(cell_index as u16)
                    && snapshot.cursor.y == Some(row_index as u16);

                let mut fg_rgb = apply_terminal_theme(
                    cell.fg.unwrap_or(default_fg),
                    default_fg,
                    default_bg,
                    &ansi_palette,
                    theme,
                );
                let mut bg_rgb = apply_terminal_theme(
                    cell.bg.unwrap_or(default_bg),
                    default_fg,
                    default_bg,
                    &ansi_palette,
                    theme,
                );

                if is_cursor && snapshot.cursor.shape == "block" {
                    std::mem::swap(&mut fg_rgb, &mut bg_rgb);
                }

                let text_value = if cell.invisible || cell.text.is_empty() {
                    " ".to_string()
                } else {
                    cell.text.clone()
                };
                let fg_color = nscolor_from_rgb(&fg_rgb);
                if let Some(ch) = text_value.chars().next() {
                    if text_value.chars().count() == 1 {
                        if let Some(sprite) = branch_sprite_for_char(ch) {
                            draw_branch_sprite(cell_rect, sprite, &fg_color);
                            continue;
                        }
                    }
                }
                let text = NSString::from_str(&text_value);
                let attrs = make_text_attributes(&font, &fg_color);
                unsafe {
                    text.drawAtPoint_withAttributes(
                        NSPoint::new(cell_x, cell_y + baseline_offset),
                        Some(&attrs),
                    );
                }

                if cell.underline {
                    fg_color.setFill();
                    NSBezierPath::fillRect(NSRect::new(
                        NSPoint::new(cell_x, cell_y + cell_height - 2.0),
                        NSSize::new(cell_width.ceil().max(1.0), 1.0),
                    ));
                }
                if cell.strikethrough {
                    fg_color.setFill();
                    NSBezierPath::fillRect(NSRect::new(
                        NSPoint::new(cell_x, cell_y + (cell_height / 2.0)),
                        NSSize::new(cell_width.ceil().max(1.0), 1.0),
                    ));
                }
            }
        }

        if snapshot.cursor.visible {
            if let (Some(x), Some(y)) = (snapshot.cursor.x, snapshot.cursor.y) {
                let cursor_rect = NSRect::new(
                    NSPoint::new(
                        origin_x + f64::from(x) * cell_width,
                        origin_y + f64::from(y) * cell_height,
                    ),
                    NSSize::new(cell_width.max(2.0), cell_height.max(2.0)),
                );
                let cursor_color = nscolor_from_rgb(&theme.cursor);
                cursor_color.setFill();
                match snapshot.cursor.shape.as_str() {
                    "bar" => NSBezierPath::fillRect(NSRect::new(
                        cursor_rect.origin,
                        NSSize::new(2.0, cursor_rect.size.height),
                    )),
                    "underline" => NSBezierPath::fillRect(NSRect::new(
                        NSPoint::new(
                            cursor_rect.origin.x,
                            cursor_rect.origin.y + cursor_rect.size.height - 2.0,
                        ),
                        NSSize::new(cursor_rect.size.width, 2.0),
                    )),
                    "hollow-block" => {
                        cursor_color.set();
                        let stroke_path = NSBezierPath::bezierPathWithRect(cursor_rect);
                        stroke_path.setLineWidth(1.0);
                        stroke_path.stroke();
                    }
                    "block" => {}
                    _ => NSBezierPath::fillRect(cursor_rect),
                }
            }
        }
    }

    pub(super) unsafe fn create_block_inner(
        app_handle: &AppHandle<Wry>,
        window: &WebviewWindow,
        manager: &Arc<Mutex<NativeTerminalState>>,
        block_id: &str,
        cwd: Option<String>,
        command: Option<String>,
    ) -> Result<(), String> {
        let mtm = MainThreadMarker::new().ok_or_else(|| {
            "Native terminal block creation must run on the main thread".to_string()
        })?;
        let mut state = manager
            .lock()
            .map_err(|_| "Failed to lock NativeTerminal manager state".to_string())?;

        if state.blocks.contains_key(block_id) {
            return Ok(());
        }

        let webview_ptr = window.ns_view().map_err(|error| error.to_string())?;
        let webview = &*(webview_ptr.cast::<NSView>());
        let parent = webview
            .superview()
            .ok_or_else(|| "Failed to get the Canvas webview parent view".to_string())?;

        ensure_native_font_registered(app_handle);

        let host_view = NativeTerminalHostView::new(
            mtm,
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(1.0, 1.0)),
        );
        host_view.setHidden(true);
        parent.addSubview_positioned_relativeTo(
            &host_view,
            NSWindowOrderingMode::Above,
            Some(webview),
        );

        crate::ghostty_vt::create_registered_session(
            app_handle,
            block_id,
            cwd.as_deref(),
            command.as_deref(),
            DEFAULT_COLS,
            DEFAULT_ROWS,
        )?;

        let host_view_ptr = Retained::into_raw(host_view) as usize;
        view_block_ids()
            .lock()
            .map_err(|_| "Failed to lock native terminal view lookup table".to_string())?
            .insert(host_view_ptr, block_id.to_string());
        block_views()
            .lock()
            .map_err(|_| "Failed to lock native terminal block lookup table".to_string())?
            .insert(block_id.to_string(), host_view_ptr);
        block_interactions()
            .lock()
            .map_err(|_| "Failed to lock native terminal interaction table".to_string())?
            .insert(block_id.to_string(), InteractionState::default());

        let visible = Arc::new(AtomicBool::new(false));

        state.blocks.insert(
            block_id.to_string(),
            NativeTerminalBlock {
                host_view: host_view_ptr,
                visible,
            },
        );
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub(super) unsafe fn update_block_inner(
        window: &WebviewWindow,
        manager: &Arc<Mutex<NativeTerminalState>>,
        block_id: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        viewport_height: f64,
        focused: bool,
        hidden: bool,
    ) -> Result<(), String> {
        let state = manager
            .lock()
            .map_err(|_| "Failed to lock NativeTerminal manager state".to_string())?;
        let block = state
            .blocks
            .get(block_id)
            .ok_or_else(|| format!("Native terminal block {block_id} was not found"))?;
        let host_view = &*(block.host_view as *const NativeTerminalHostView);
        let webview_ptr = window.ns_view().map_err(|error| error.to_string())?;
        let webview = &*(webview_ptr.cast::<NSView>());
        let parent = webview
            .superview()
            .ok_or_else(|| "Webview has no superview".to_string())?;

        let flipped_y = (viewport_height - y - height).max(0.0);
        let rect_in_webview = NSRect::new(
            NSPoint::new(x.max(0.0), flipped_y),
            NSSize::new(width.max(0.0), height.max(0.0)),
        );
        let rect_in_parent = parent.convertRect_fromView(rect_in_webview, Some(webview));

        host_view.setFrame(rect_in_parent);
        host_view.setHidden(hidden || width < 1.0 || height < 1.0);
        host_view.setNeedsDisplay(true);
        block
            .visible
            .store(!(hidden || width < 1.0 || height < 1.0), Ordering::SeqCst);

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

        if !(hidden || width < 1.0 || height < 1.0) {
            let (_, cell_width, cell_height, _) = terminal_font_metrics();
            let cols = (((width - (TERMINAL_PADDING_X * 2.0)).max(1.0) / cell_width).floor() as u16)
                .max(2);
            let rows = (((height - (TERMINAL_PADDING_Y * 2.0)).max(1.0) / cell_height).floor() as u16)
                .max(1);
            crate::ghostty_vt::resize_registered_session(
                block_id,
                cols,
                rows,
                cell_width.round() as u32,
                cell_height.round() as u32,
            )?;
        }

        if focused && !hidden {
            if let Some(window) = host_view.window() {
                let _ = window.makeFirstResponder(Some(host_view));
            }
        }

        Ok(())
    }

    pub(super) unsafe fn destroy_block_inner(
        manager: &Arc<Mutex<NativeTerminalState>>,
        block_id: &str,
    ) -> Result<(), String> {
        let block = {
            let mut state = manager
                .lock()
                .map_err(|_| "Failed to lock NativeTerminal manager state".to_string())?;
            state.blocks.remove(block_id)
        };
        let Some(block) = block else {
            return Ok(());
        };

        block.visible.store(false, Ordering::SeqCst);

        view_block_ids()
            .lock()
            .map_err(|_| "Failed to lock native terminal view lookup table".to_string())?
            .remove(&block.host_view);
        block_views()
            .lock()
            .map_err(|_| "Failed to lock native terminal block lookup table".to_string())?
            .remove(block_id);
        block_interactions()
            .lock()
            .map_err(|_| "Failed to lock native terminal interaction table".to_string())?
            .remove(block_id);

        let host_view = Retained::from_raw(block.host_view as *mut NativeTerminalHostView)
            .ok_or_else(|| format!("Native terminal block {block_id} stored an invalid view pointer"))?;
        host_view.removeFromSuperview();
        drop(host_view);

        crate::ghostty_vt::destroy_registered_session(block_id)?;
        Ok(())
    }

    fn string_from_nsstring(value: &NSString) -> Option<String> {
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
}
