import { useEffect, useRef, useState, useCallback } from 'react';
import { init, Terminal, FitAddon } from 'ghostty-web';
import { useTerminals } from '../../hooks/useTerminals';
import { getRuntimeApiBaseUrl } from '../../lib/config';
import { client } from '@ottocode/api';

const FONT_FAMILY = '"JetBrainsMono NFM", monospace';
const SSE_RECONNECT_DELAY = 1500;
const SSE_MAX_RETRIES = 5;

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
	onExit?: (terminalId: string) => void;
}

export function TerminalViewer({ terminalId, onExit }: TerminalViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const retryCountRef = useRef(0);
	const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [ready, setReady] = useState(false);
	const { data: terminals } = useTerminals();

	const terminal = terminals?.terminals.find((t) => t.id === terminalId);

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
		(xterm: Terminal, baseUrl: string) => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}

			const eventSource = new EventSource(
				`${baseUrl}/v1/terminals/${terminalId}/output`,
			);
			eventSourceRef.current = eventSource;

			let gotFirstData = false;

			eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type === 'data') {
						xterm.write(data.line);
						if (!gotFirstData) {
							gotFirstData = true;
							setTimeout(() => setReady(true), 200);
						}
				} else if (data.type === 'exit') {
					xterm.write(
						`\r\n\x1b[33m[Process exited with code ${data.exitCode}]\x1b[0m\r\n`,
					);
					if (onExit) {
						onExit(terminalId);
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
						if (xtermRef.current) {
							connectSSE(xtermRef.current, baseUrl);
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
		let xterm: Terminal | null = null;
		let fitAddon: FitAddon | null = null;
		let resizeObserver: ResizeObserver | null = null;

		setReady(false);
		retryCountRef.current = 0;

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

			xterm = new Terminal({
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
			xterm.loadAddon(fitAddon);
			xterm.open(containerRef.current);
			xterm.focus();

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

			if (xterm) {
				sendResize(xterm.cols, xterm.rows);
			}

			connectSSE(xterm, baseUrl);

			xterm.onData((data) => {
				fetch(`${baseUrl}/v1/terminals/${terminalId}/input`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ input: data }),
				}).catch(() => {});
			});

			xterm.onResize(({ cols, rows }) => {
				sendResize(cols, rows);
			});

			xtermRef.current = xterm;
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
			if (xterm) {
				xterm.dispose();
			}
			xtermRef.current = null;
			fitAddonRef.current = null;
		};
	}, [terminalId, connectSSE]);

	useEffect(() => {
		fitTerminal();
	}, [fitTerminal]);

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
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
