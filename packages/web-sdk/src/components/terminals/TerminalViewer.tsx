import { useEffect, useRef, useState } from 'react';
import { init, Terminal, FitAddon } from 'ghostty-web';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useTerminals } from '../../hooks/useTerminals';
import { useTerminalStore } from '../../stores/terminalStore';
import { getRuntimeApiBaseUrl } from '../../lib/config';
import { client } from '@agi-cli/api';

const FONT_FAMILY = '"JetBrainsMono NFM", monospace';

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
}

export function TerminalViewer({ terminalId }: TerminalViewerProps) {
	const termRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const [ready, setReady] = useState(false);
	const { data: terminals } = useTerminals();
	const { selectTerminal } = useTerminalStore();

	const terminal = terminals?.terminals.find((t) => t.id === terminalId);

	const handleKill = async () => {
		try {
			const baseUrl = resolveApiBaseUrl();
			await fetch(`${baseUrl}/v1/terminals/${terminalId}`, {
				method: 'DELETE',
			});
			selectTerminal(null);
		} catch (error) {
			console.error('Failed to kill terminal:', error);
		}
	};

	useEffect(() => {
		if (!termRef.current || !terminalId) return;

		let disposed = false;
		let xterm: Terminal | null = null;
		let fitAddon: FitAddon | null = null;
		let handleResize: (() => void) | null = null;

		setReady(false);

		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}

		const setup = async () => {
			await init();
			if (disposed || !termRef.current) return;

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
				scrollback: 1000,
			});

			fitAddon = new FitAddon();
			xterm.loadAddon(fitAddon);
			xterm.open(termRef.current);
			xterm.focus();

			await new Promise<void>((resolve) => {
				requestAnimationFrame(() => {
					try {
						fitAddon?.fit();
					} catch (error) {
						console.error('Failed to fit terminal:', error);
					}
					resolve();
				});
			});

			if (disposed) return;

			const baseUrl = resolveApiBaseUrl();
			const eventSource = new EventSource(
				`${baseUrl}/v1/terminals/${terminalId}/output`,
			);
			eventSourceRef.current = eventSource;

			let gotFirstData = false;

			eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					if (data.type === 'data') {
						xterm?.write(data.line);
						if (!gotFirstData) {
							gotFirstData = true;
							setTimeout(() => {
								if (!disposed) setReady(true);
							}, 350);
						}
					} else if (data.type === 'exit') {
						xterm?.write(
							`\r\n\x1b[33m[Process exited with code ${data.exitCode}]\x1b[0m\r\n`,
						);
					}
				} catch (error) {
					console.error('Failed to parse terminal output:', error);
				}
			};

			eventSource.onerror = (error) => {
				if (eventSource.readyState !== EventSource.CLOSED) {
					console.error('[TerminalViewer] SSE error:', error);
				}
				eventSource.close();
				if (eventSourceRef.current === eventSource) {
					eventSourceRef.current = null;
				}
			};

			xterm.onData((data) => {
				fetch(`${baseUrl}/v1/terminals/${terminalId}/input`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ input: data }),
				}).catch((error) => {
					console.error('Failed to send terminal input:', error);
				});
			});

			xtermRef.current = xterm;
			fitAddonRef.current = fitAddon;

			handleResize = () => {
				if (fitAddonRef.current) {
					try {
						fitAddonRef.current.fit();
					} catch (error) {
						console.error('Failed to fit terminal on resize:', error);
					}
				}
			};
			window.addEventListener('resize', handleResize);

			setTimeout(() => {
				if (!disposed && !gotFirstData) setReady(true);
			}, 2000);
		};

		setup().catch((error) => {
			console.error('[TerminalViewer] Failed to initialize:', error);
		});

		return () => {
			disposed = true;
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
			if (handleResize) {
				window.removeEventListener('resize', handleResize);
			}
			if (xterm) {
				xterm.dispose();
			}
		};
	}, [terminalId]);

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
			<div className="h-10 border-b border-border px-3 flex items-center justify-between shrink-0 bg-background">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => selectTerminal(null)}
						title="Back to terminal list"
						className="h-6 w-6 shrink-0"
					>
						<ArrowLeft className="w-3.5 h-3.5" />
					</Button>
					<span className="text-xs font-medium text-muted-foreground truncate">
						{terminal?.title || terminal?.purpose || terminalId}
					</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={handleKill}
					title="Kill terminal"
					className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
				>
					<X className="w-3.5 h-3.5" />
				</Button>
			</div>

			<div className="relative flex-1 min-h-0 overflow-hidden">
				<div ref={termRef} className="absolute inset-0 bg-background" />
				<div
					className="absolute inset-0 bg-background flex items-center justify-center pointer-events-none transition-opacity duration-300"
					style={{ opacity: ready ? 0 : 1 }}
				>
					<div className="flex items-center gap-2 text-muted-foreground">
						<svg
							className="animate-spin h-4 w-4"
							viewBox="0 0 24 24"
							fill="none"
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
