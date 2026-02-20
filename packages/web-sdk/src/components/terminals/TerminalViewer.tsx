import { useEffect, useRef, useState, useCallback } from 'react';
import { init, Terminal, FitAddon } from 'ghostty-web';
import { getRuntimeApiBaseUrl } from '../../lib/config';
import { client } from '@ottocode/api';

const FONT_FAMILY = '"JetBrainsMono NFM", monospace';
const SSE_RECONNECT_DELAY = 1500;
const SSE_MAX_RETRIES = 5;
const CURSOR_BLINK_RESUME_DELAY = 600;

function resolveBackgroundColor(): string {
	if (typeof document === 'undefined') return '#121216';
	const el = document.createElement('div');
	el.style.display = 'none';
	el.className = 'bg-background';
	document.body.appendChild(el);
	const computed = getComputedStyle(el).backgroundColor;
	document.body.removeChild(el);
	const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
	if (match) {
		const r = Number(match[1]);
		const g = Number(match[2]);
		const b = Number(match[3]);
		return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
	}
	return '#121216';
}

let fontsLoaded = false;

async function loadEmbeddedFont(): Promise<void> {
	if (fontsLoaded) return;
	if (typeof document === 'undefined' || !('FontFace' in window)) return;

	const variants = [
		{
			file: 'JetBrainsMonoNerdFontMono-Regular.woff2',
			weight: '400',
			style: 'normal',
		},
		{
			file: 'JetBrainsMonoNerdFontMono-Bold.woff2',
			weight: '700',
			style: 'normal',
		},
		{
			file: 'JetBrainsMonoNerdFontMono-Italic.woff2',
			weight: '400',
			style: 'italic',
		},
		{
			file: 'JetBrainsMonoNerdFontMono-BoldItalic.woff2',
			weight: '700',
			style: 'italic',
		},
	];

	const loads = variants.map(async (v) => {
		try {
			const url = new URL(`../../assets/fonts/${v.file}`, import.meta.url).href;
			const face = new FontFace(
				'JetBrainsMono NFM',
				`url("${url}") format("woff2")`,
				{
					weight: v.weight,
					style: v.style,
				},
			);
			const loaded = await face.load();
			document.fonts.add(loaded);
		} catch {
			// variant not available
		}
	});

	await Promise.allSettled(loads);
	fontsLoaded = true;
}

function resolveApiBaseUrl(): string {
	const config = client.getConfig?.();
	if (
		config &&
		typeof config.baseURL === 'string' &&
		config.baseURL.length > 0
	) {
		return config.baseURL;
	}
	return getRuntimeApiBaseUrl();
}

interface TerminalViewerProps {
	terminalId: string;
	isActive: boolean;
	onExit?: (terminalId: string) => void;
}

export function TerminalViewer({
	terminalId,
	isActive,
	onExit,
}: TerminalViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const termRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const retryCountRef = useRef(0);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hasReceivedDataRef = useRef(false);
	const [ready, setReady] = useState(false);
	const onExitRef = useRef(onExit);
	onExitRef.current = onExit;
	const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const userScrolledRef = useRef(false);
	const bgColorRef = useRef('#121216');
	const focusHandlersRef = useRef<{
		focusin: () => void;
		focusout: () => void;
	} | null>(null);

	const fitTerminal = useCallback(() => {
		if (fitAddonRef.current) {
			try {
				fitAddonRef.current.fit();
			} catch {
				// container might not be visible yet
			}
		}
	}, []);

	const connectSSE = useCallback(
		(term: Terminal, baseUrl: string, skipHistory: boolean) => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}

			const url = `${baseUrl}/v1/terminals/${terminalId}/output${skipHistory ? '?skipHistory=true' : ''}`;
			const eventSource = new EventSource(url);
			eventSourceRef.current = eventSource;

			let gotFirstData = false;

			eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type === 'data') {
						const savedY = userScrolledRef.current ? term.getViewportY() : 0;
						term.write(data.line);
						if (userScrolledRef.current && savedY > 0) {
							term.scrollToLine(savedY);
						}
						hasReceivedDataRef.current = true;
						if (!gotFirstData) {
							gotFirstData = true;
							setTimeout(() => setReady(true), 200);
						}
					} else if (data.type === 'exit') {
						term.write(
							`\r\n\x1b[33m[Process exited with code ${data.exitCode}]\x1b[0m\r\n`,
						);
						if (onExitRef.current) {
							onExitRef.current(terminalId);
						}
					}
				} catch {
					// ignore parse errors
				}
			};

			eventSource.onerror = () => {
				eventSource.close();
				if (eventSourceRef.current === eventSource) {
					eventSourceRef.current = null;
				}

				if (retryCountRef.current < SSE_MAX_RETRIES) {
					retryCountRef.current++;
					retryTimerRef.current = setTimeout(() => {
						if (termRef.current) {
							connectSSE(termRef.current, baseUrl, true);
						}
					}, SSE_RECONNECT_DELAY);
				}
			};

			eventSource.onopen = () => {
				retryCountRef.current = 0;
			};
		},
		[terminalId],
	);

	useEffect(() => {
		if (!containerRef.current || !terminalId) return;

		let disposed = false;
		let term: Terminal | null = null;
		let fitAddon: FitAddon | null = null;
		let resizeObserver: ResizeObserver | null = null;

		setReady(false);
		retryCountRef.current = 0;
		hasReceivedDataRef.current = false;

		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		if (retryTimerRef.current) {
			clearTimeout(retryTimerRef.current);
			retryTimerRef.current = null;
		}

		const setup = async () => {
			await init();
			if (disposed || !containerRef.current) return;

			await loadEmbeddedFont();
			await document.fonts.ready;

			const bg = resolveBackgroundColor();

			term = new Terminal({
				theme: {
					background: bg,
					foreground: '#d4d4d4',
					cursor: '#ffffff',
					cursorAccent: '#000000',
					selectionBackground: '#264f78',
					black: '#000000',
					red: '#cd3131',
					green: '#0dbc79',
					yellow: '#e5e510',
					blue: '#2472c8',
					magenta: '#bc3fbc',
					cyan: '#11a8cd',
					white: '#e5e5e5',
					brightBlack: '#666666',
					brightRed: '#f14c4c',
					brightGreen: '#23d18b',
					brightYellow: '#f5f543',
					brightBlue: '#3b8eea',
					brightMagenta: '#d670d6',
					brightCyan: '#29b8db',
					brightWhite: '#e5e5e5',
				},
				fontSize: 13,
				fontFamily: FONT_FAMILY,
				cursorBlink: true,
				convertEol: true,
				scrollback: 5000,
			});

			fitAddon = new FitAddon();
			term.loadAddon(fitAddon);
			term.open(containerRef.current);

			term.onData(() => {
				if (!termRef.current?.renderer) return;
				termRef.current.renderer.setCursorBlink(false);
				if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current);
				blinkTimerRef.current = setTimeout(() => {
					if (
						termRef.current?.renderer &&
						document.activeElement &&
						containerRef.current?.contains(document.activeElement)
					) {
						termRef.current.renderer.setCursorBlink(true);
					}
				}, CURSOR_BLINK_RESUME_DELAY);
			});

			bgColorRef.current = bg;

			const handleFocusIn = () => {
				if (!termRef.current?.renderer) return;
				termRef.current.renderer.setCursorBlink(true);
				termRef.current.renderer.setTheme({
					cursor: '#ffffff',
					cursorAccent: '#000000',
				});
			};

			const handleFocusOut = () => {
				if (!termRef.current?.renderer) return;
				termRef.current.renderer.setCursorBlink(false);
				termRef.current.renderer.setTheme({
					cursor: bgColorRef.current,
					cursorAccent: bgColorRef.current,
				});
			};

			containerRef.current.addEventListener('focusin', handleFocusIn);
			containerRef.current.addEventListener('focusout', handleFocusOut);
			focusHandlersRef.current = {
				focusin: handleFocusIn,
				focusout: handleFocusOut,
			};

			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => {
					try {
						fitAddon?.fit();
					} catch {
						// container might not be visible
					}
					resolve();
				});
			});

			if (disposed) return;

			const baseUrl = resolveApiBaseUrl();

			const sendResize = (cols: number, rows: number) => {
				fetch(`${baseUrl}/v1/terminals/${terminalId}/resize`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ cols, rows }),
				}).catch(() => {});
			};

			if (term) {
				sendResize(term.cols, term.rows);
			}

			connectSSE(term, baseUrl, false);

			term.onData((data) => {
				fetch(`${baseUrl}/v1/terminals/${terminalId}/input`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ input: data }),
				}).catch(() => {});
			});

			term.onResize(({ cols, rows }) => {
				sendResize(cols, rows);
			});

			term.onScroll(() => {
				userScrolledRef.current = term.getViewportY() > 0;
			});

			termRef.current = term;
			fitAddonRef.current = fitAddon;

			resizeObserver = new ResizeObserver(() => {
				requestAnimationFrame(() => {
					if (fitAddonRef.current && !disposed) {
						try {
							fitAddonRef.current.fit();
						} catch {
							// ignore
						}
					}
				});
			});
			resizeObserver.observe(containerRef.current);

			setTimeout(() => {
				if (!disposed) setReady(true);
			}, 2000);
		};

		setup().catch((error) => {
			console.error('[TerminalViewer] Failed to initialize:', error);
		});

		return () => {
			disposed = true;
			if (containerRef.current && focusHandlersRef.current) {
				containerRef.current.removeEventListener(
					'focusin',
					focusHandlersRef.current.focusin,
				);
				containerRef.current.removeEventListener(
					'focusout',
					focusHandlersRef.current.focusout,
				);
				focusHandlersRef.current = null;
			}
			if (blinkTimerRef.current) {
				clearTimeout(blinkTimerRef.current);
				blinkTimerRef.current = null;
			}
			if (retryTimerRef.current) {
				clearTimeout(retryTimerRef.current);
				retryTimerRef.current = null;
			}
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
			if (resizeObserver) {
				resizeObserver.disconnect();
			}
			if (term) {
				term.dispose();
			}
			termRef.current = null;
			fitAddonRef.current = null;
		};
	}, [terminalId, connectSSE]);

	useEffect(() => {
		const term = termRef.current;
		if (!term) return;
		if (isActive) {
			fitTerminal();
			term.focus();
		} else {
			term.blur();
			if (term.renderer) {
				term.renderer.setCursorBlink(false);
				term.renderer.setTheme({
					cursor: bgColorRef.current,
					cursorAccent: bgColorRef.current,
				});
			}
		}
	}, [isActive, fitTerminal]);

	useEffect(() => {
		fitTerminal();
	}, [fitTerminal]);

	return (
		<div
			className="flex h-full flex-col overflow-hidden bg-background absolute inset-0"
			style={{ visibility: isActive ? 'visible' : 'hidden' }}
			data-terminal-viewer
		>
			<div className="relative flex-1 min-h-0 overflow-hidden">
				<div ref={containerRef} className="absolute inset-0 bg-background" />
				<div
					className="absolute inset-0 bg-background flex items-center justify-center pointer-events-none transition-opacity duration-300"
					style={{ opacity: ready ? 0 : 1 }}
				>
					<div className="flex items-center gap-2 text-muted-foreground">
						<svg
							className="animate-spin h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
							aria-hidden="true"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							/>
						</svg>
						<span className="text-xs">Loading terminal…</span>
					</div>
				</div>
			</div>
		</div>
	);
}
