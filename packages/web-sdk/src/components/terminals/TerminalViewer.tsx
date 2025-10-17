import { useEffect, useRef } from 'react';
import { FitAddon } from '@xterm/addon-fit';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { Terminal } from '@xterm/xterm';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { useTerminals } from '../../hooks/useTerminals';
import { useTerminalStore } from '../../stores/terminalStore';
import { getRuntimeApiBaseUrl } from '../../lib/config';
import '@xterm/xterm/css/xterm.css';
import { client } from '@agi-cli/api';

const NERD_FONT_STACK = [
	'"Symbols Nerd Font Mono"',
	'"Symbols Nerd Font"',
	'"JetBrainsMono Nerd Font Mono"',
	'"JetBrainsMono Nerd Font"',
	'"JetBrains Mono Nerd Font Mono"',
	'"JetBrains Mono Nerd Font"',
	'"FiraCode Nerd Font Mono"',
	'"FiraCode Nerd Font"',
	'"Fira Code Nerd Font Mono"',
	'"Fira Code Nerd Font"',
	'"CaskaydiaCove Nerd Font"',
	'"Caskaydia Cove Nerd Font"',
	'"Cascadia Code PL"',
	'"Hack Nerd Font Mono"',
	'"Hack Nerd Font"',
	'"MesloLGS NF"',
];
const FALLBACK_FONT_STACK = ['Menlo', 'Monaco', '"Courier New"', 'monospace'];

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

function resolveFontFamily(): string {
	if (typeof document !== 'undefined' && 'fonts' in document) {
		const available = NERD_FONT_STACK.filter((font) => {
			try {
				return document.fonts.check(`12px ${font}`);
			} catch {
				return false;
			}
		});

		if (available.length > 0) {
			return [...available, ...FALLBACK_FONT_STACK].join(', ');
		}
	}

	return [...NERD_FONT_STACK, ...FALLBACK_FONT_STACK].join(', ');
}

interface TerminalViewerProps {
	terminalId: string;
}

export function TerminalViewer({ terminalId }: TerminalViewerProps) {
	const termRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
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

		// Prevent duplicate connections - close existing EventSource
		if (eventSourceRef.current) {
			console.log('[TerminalViewer] Closing existing EventSource');
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}

		console.log('[TerminalViewer] Setting up terminal:', terminalId);

		const resolvedFontFamily = resolveFontFamily();

		const xterm = new Terminal({
			theme: {
				background: '#1e1e1e',
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
			fontFamily: resolvedFontFamily,
			cursorBlink: true,
			convertEol: true,
			scrollback: 1000,
			allowProposedApi: true,
		});

		const fitAddon = new FitAddon();
		const unicodeAddon = new Unicode11Addon();
		xterm.loadAddon(fitAddon);
		xterm.loadAddon(unicodeAddon);
		xterm.unicode.activeVersion = '11';
		xterm.open(termRef.current);
		// Force font family on rendered DOM nodes in case xterm doesn't pick up config immediately
		const fontTargets = termRef.current.querySelectorAll<HTMLElement>(
			'.xterm, .xterm-rows, .xterm-helper-textarea',
		);
		fontTargets.forEach((node) => {
			node.style.fontFamily = resolvedFontFamily;
		});

		// Fit after a short delay to ensure DOM is ready
		setTimeout(() => {
			try {
				fitAddon.fit();
			} catch (error) {
				console.error('Failed to fit terminal:', error);
			}
		}, 50);

		const baseUrl = resolveApiBaseUrl();
		const eventSource = new EventSource(
			`${baseUrl}/v1/terminals/${terminalId}/output`,
		);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			console.log('[TerminalViewer] SSE connection opened:', terminalId);
		};

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'data') {
					xterm.write(data.line);
				} else if (data.type === 'exit') {
					xterm.write(
						`\r\n\x1b[33m[Process exited with code ${data.exitCode}]\x1b[0m\r\n`,
					);
				}
			} catch (error) {
				console.error('Failed to parse terminal output:', error);
			}
		};

		eventSource.onerror = (error) => {
			if (eventSource.readyState !== EventSource.CLOSED) {
				console.error('[TerminalViewer] SSE connection error:', {
					terminalId,
					url: `${baseUrl}/v1/terminals/${terminalId}/output`,
					readyState: eventSource.readyState,
					readyStateText:
						eventSource.readyState === 0
							? 'CONNECTING'
							: eventSource.readyState === 1
								? 'OPEN'
								: 'CLOSED',
					error,
				});
			}

			// Close the EventSource to prevent auto-reconnect loop
			console.log('[TerminalViewer] Closing EventSource due to error');
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

		// Handle window resize
		const handleResize = () => {
			if (fitAddonRef.current) {
				try {
					fitAddonRef.current.fit();
				} catch (error) {
					console.error('Failed to fit terminal on resize:', error);
				}
			}
		};
		window.addEventListener('resize', handleResize);

		return () => {
			console.log('[TerminalViewer] Cleanup:', terminalId);
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
			window.removeEventListener('resize', handleResize);
			xterm.dispose();
		};
	}, [terminalId]);

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
			{/* Header */}
			<div className="h-10 border-b border-border px-3 flex items-center justify-between shrink-0 bg-muted/40">
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

			{/* Terminal */}
			<div ref={termRef} className="h-full w-full bg-background" />
		</div>
	);
}
