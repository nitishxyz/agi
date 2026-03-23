use std::{
	collections::HashMap,
	sync::{Arc, Mutex},
};
use tauri::{AppHandle, WebviewWindow, Wry};

#[derive(Clone, Default)]
pub struct BrowserManager {
	inner: Arc<Mutex<BrowserState>>,
}

#[derive(Default)]
struct BrowserState {
	blocks: HashMap<String, BrowserBlock>,
}

struct BrowserBlock {
	webview: usize,
}

unsafe impl Send for BrowserState {}
unsafe impl Send for BrowserBlock {}

#[tauri::command]
pub fn browser_create_block(
	app_handle: AppHandle<Wry>,
	manager: tauri::State<'_, BrowserManager>,
	block_id: String,
	url: String,
	user_agent: Option<String>,
) -> Result<(), String> {
	#[cfg(target_os = "macos")]
	{
		let manager = manager.inner().inner.clone();
		let window = crate::ghostty::main_canvas_window(&app_handle)?;
		crate::ghostty::run_on_main_thread_sync(&app_handle, move || unsafe {
			macos::create_block_inner(&window, &manager, &block_id, &url, user_agent.as_deref())
		})
	}

	#[cfg(not(target_os = "macos"))]
	{
		let _ = (app_handle, manager, block_id, url, user_agent);
		Err("Browser blocks are currently implemented for macOS only.".into())
	}
}

#[tauri::command]
pub fn browser_update_block(
	app_handle: AppHandle<Wry>,
	manager: tauri::State<'_, BrowserManager>,
	block_id: String,
	x: f64,
	y: f64,
	width: f64,
	height: f64,
	viewport_height: f64,
	focused: bool,
) -> Result<(), String> {
	#[cfg(target_os = "macos")]
	{
		let manager = manager.inner().inner.clone();
		let window = crate::ghostty::main_canvas_window(&app_handle)?;
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
			)
		})
	}

	#[cfg(not(target_os = "macos"))]
	{
		let _ = (app_handle, manager, block_id, x, y, width, height, viewport_height, focused);
		Err("Browser blocks are currently implemented for macOS only.".into())
	}
}

#[tauri::command]
pub fn browser_navigate_block(
	app_handle: AppHandle<Wry>,
	manager: tauri::State<'_, BrowserManager>,
	block_id: String,
	url: String,
) -> Result<(), String> {
	#[cfg(target_os = "macos")]
	{
		let manager = manager.inner().inner.clone();
		crate::ghostty::run_on_main_thread_sync(&app_handle, move || unsafe {
			macos::navigate_block_inner(&manager, &block_id, &url)
		})
	}

	#[cfg(not(target_os = "macos"))]
	{
		let _ = (app_handle, manager, block_id, url);
		Err("Browser blocks are currently implemented for macOS only.".into())
	}
}

#[tauri::command]
pub fn browser_reload_block(
	app_handle: AppHandle<Wry>,
	manager: tauri::State<'_, BrowserManager>,
	block_id: String,
) -> Result<(), String> {
	#[cfg(target_os = "macos")]
	{
		let manager = manager.inner().inner.clone();
		crate::ghostty::run_on_main_thread_sync(&app_handle, move || unsafe {
			macos::reload_block_inner(&manager, &block_id)
		})
	}

	#[cfg(not(target_os = "macos"))]
	{
		let _ = (app_handle, manager, block_id);
		Err("Browser blocks are currently implemented for macOS only.".into())
	}
}

#[tauri::command]
pub fn browser_destroy_block(
	app_handle: AppHandle<Wry>,
	manager: tauri::State<'_, BrowserManager>,
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
		Err("Browser blocks are currently implemented for macOS only.".into())
	}
}

#[cfg(target_os = "macos")]
mod macos {
	use super::*;
	use objc2::MainThreadMarker;
	use objc2::rc::Retained;
	use objc2_app_kit::{NSView, NSWindowOrderingMode};
	use objc2_foundation::{NSObjectProtocol, NSPoint, NSRect, NSSize, NSString, NSURL, NSURLRequest};
	use objc2_web_kit::{WKWebView, WKWebViewConfiguration};

	unsafe fn request_for_url(url: &str) -> Result<Retained<NSURLRequest>, String> {
		let url = NSURL::URLWithString(&NSString::from_str(url))
			.ok_or_else(|| format!("Invalid browser URL: {url}"))?;
		Ok(NSURLRequest::requestWithURL(&url))
	}

	pub(super) unsafe fn create_block_inner(
		window: &WebviewWindow,
		manager: &Arc<Mutex<BrowserState>>,
		block_id: &str,
		url: &str,
		user_agent: Option<&str>,
	) -> Result<(), String> {
		let mtm = MainThreadMarker::new()
			.ok_or_else(|| "Browser block creation must run on the main thread".to_string())?;
		let mut state = manager.lock().map_err(|_| "Failed to lock Browser manager state".to_string())?;

		if state.blocks.contains_key(block_id) {
			return Ok(());
		}

		let webview_ptr = window.ns_view().map_err(|error| error.to_string())?;
		let webview = unsafe { &*(webview_ptr.cast::<NSView>()) };
		let parent = unsafe { webview.superview() }
			.ok_or_else(|| "Failed to get the Canvas webview parent view".to_string())?;

		let configuration = WKWebViewConfiguration::new(mtm);
		let browser_view = WKWebView::initWithFrame_configuration(
			mtm.alloc::<WKWebView>(),
			NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(0.0, 0.0)),
			&configuration,
		);
		if let Some(user_agent) = user_agent {
			browser_view.setCustomUserAgent(Some(&NSString::from_str(user_agent)));
		}
		browser_view.setHidden(true);
		parent.addSubview_positioned_relativeTo(&browser_view, NSWindowOrderingMode::Above, Some(webview));

		let request = unsafe { request_for_url(url)? };
		let _ = browser_view.loadRequest(&request);

		state.blocks.insert(
			block_id.to_string(),
			BrowserBlock {
				webview: Retained::into_raw(browser_view) as usize,
			},
		);
		Ok(())
	}

	pub(super) unsafe fn update_block_inner(
		window: &WebviewWindow,
		manager: &Arc<Mutex<BrowserState>>,
		block_id: &str,
		x: f64,
		y: f64,
		width: f64,
		height: f64,
		viewport_height: f64,
		focused: bool,
	) -> Result<(), String> {
		let state = manager.lock().map_err(|_| "Failed to lock Browser manager state".to_string())?;
		let block = state.blocks.get(block_id).ok_or_else(|| format!("Browser block {block_id} was not found"))?;
		let browser_view = unsafe { &*(block.webview as *const WKWebView) };
		let webview_ptr = window.ns_view().map_err(|error| error.to_string())?;
		let webview = unsafe { &*(webview_ptr.cast::<NSView>()) };

		let flipped_y = (viewport_height - y - height).max(0.0);
		let rect_in_webview = NSRect::new(
			NSPoint::new(x.max(0.0), flipped_y),
			NSSize::new(width.max(0.0), height.max(0.0)),
		);

		let parent = unsafe { webview.superview() }
			.ok_or_else(|| "Webview has no superview".to_string())?;
		let rect_in_parent = parent.convertRect_fromView(rect_in_webview, Some(webview));

		browser_view.setFrame(rect_in_parent);
		browser_view.setHidden(width < 1.0 || height < 1.0);

		let needs_reparent = browser_view
			.superview()
			.map_or(true, |current| !current.isEqual(Some(&*parent)));
		if needs_reparent {
			browser_view.removeFromSuperview();
			parent.addSubview_positioned_relativeTo(browser_view, NSWindowOrderingMode::Above, Some(webview));
		}

		if focused {
			if let Some(window) = browser_view.window() {
				let _ = window.makeFirstResponder(Some(browser_view));
			}
		}

		Ok(())
	}

	pub(super) unsafe fn navigate_block_inner(
		manager: &Arc<Mutex<BrowserState>>,
		block_id: &str,
		url: &str,
	) -> Result<(), String> {
		let state = manager.lock().map_err(|_| "Failed to lock Browser manager state".to_string())?;
		let block = state.blocks.get(block_id).ok_or_else(|| format!("Browser block {block_id} was not found"))?;
		let browser_view = unsafe { &*(block.webview as *const WKWebView) };
		let request = unsafe { request_for_url(url)? };
		let _ = browser_view.loadRequest(&request);
		Ok(())
	}

	pub(super) unsafe fn reload_block_inner(
		manager: &Arc<Mutex<BrowserState>>,
		block_id: &str,
	) -> Result<(), String> {
		let state = manager.lock().map_err(|_| "Failed to lock Browser manager state".to_string())?;
		let block = state.blocks.get(block_id).ok_or_else(|| format!("Browser block {block_id} was not found"))?;
		let browser_view = unsafe { &*(block.webview as *const WKWebView) };
		let _ = browser_view.reload();
		Ok(())
	}

	pub(super) unsafe fn destroy_block_inner(
		manager: &Arc<Mutex<BrowserState>>,
		block_id: &str,
	) -> Result<(), String> {
		let mut state = manager.lock().map_err(|_| "Failed to lock Browser manager state".to_string())?;
		let Some(block) = state.blocks.remove(block_id) else {
			return Ok(());
		};
		let browser_view = unsafe { Retained::from_raw(block.webview as *mut WKWebView) }
			.ok_or_else(|| format!("Browser block {block_id} stored an invalid webview pointer"))?;
		browser_view.removeFromSuperview();
		drop(browser_view);
		Ok(())
	}
}
