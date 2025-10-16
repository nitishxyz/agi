import { Button } from '../ui/Button';
import { memo, useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { ChevronLeft, X } from 'lucide-react';
import { useTerminalStore } from '../../stores/terminalStore';
import { useTerminalOutput, useKillTerminal } from '../../hooks/useTerminals';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewerProps {
	terminalId: string;
}

export const TerminalViewer = memo(function TerminalViewer({
	terminalId,
}: TerminalViewerProps) {
	const termRef = useRef<HTMLDivElement>(null);
	const xtermRef = useRef<XTerm>(null);
	const fitAddonRef = useRef<FitAddon>(null);

	const selectTerminal = useTerminalStore((state) => state.selectTerminal);
	const { data: terminal } = useTerminalOutput(terminalId);
	const killTerminal = useKillTerminal();

	useEffect(() => {
		if (!termRef.current) return;

		const xterm = new XTerm({
			theme: {
				background: '#1e1e1e',
				foreground: '#cccccc',
				cursor: '#cccccc',
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
			fontFamily: 'Menlo, Monaco, "Courier New", monospace',
			cursorBlink: true,
			convertEol: true,
			scrollback: 1000,
		});

		const fitAddon = new FitAddon();
		xterm.loadAddon(fitAddon);
		xterm.open(termRef.current);
		fitAddon.fit();

		const eventSource = new EventSource(`/api/terminals/${terminalId}/output`);

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'data') {
					xterm.write(`${data.line}\r\n`);
				} else if (data.type === 'exit') {
					xterm.write(
						`\r\n\x1b[33m[Process exited with code ${data.exitCode}]\x1b[0m\r\n`,
					);
				}
			} catch (error) {
				console.error('Failed to parse terminal output:', error);
			}
		};

		eventSource.onerror = () => {
			console.error('SSE connection error');
		};

		xterm.onData((data) => {
			fetch(`/api/terminals/${terminalId}/input`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ input: data }),
			}).catch((error) => {
				console.error('Failed to send terminal input:', error);
			});
		});

		xtermRef.current = xterm;
		fitAddonRef.current = fitAddon;

		const resizeObserver = new ResizeObserver(() => {
			fitAddon.fit();
		});
		resizeObserver.observe(termRef.current);

		return () => {
			resizeObserver.disconnect();
			eventSource.close();
			xterm.dispose();
		};
	}, [terminalId]);

	const handleBack = () => {
		selectTerminal(null);
	};

	const handleKill = async () => {
		try {
			await killTerminal.mutateAsync(terminalId);
			selectTerminal(null);
		} catch (error) {
			console.error('Failed to kill terminal:', error);
		}
	};

	return (
		<div className="flex flex-col h-full">
			<div className="h-12 border-b border-border px-3 flex items-center justify-between shrink-0">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" onClick={handleBack}>
						<ChevronLeft className="w-4 h-4" />
					</Button>
					<div className="flex flex-col">
						<span className="text-sm font-medium">
							{terminal?.title || terminal?.purpose}
						</span>
						<span className="text-xs text-muted-foreground">
							{terminal?.status === 'running'
								? 'Running'
								: `Exited (${terminal?.exitCode})`}
						</span>
					</div>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={handleKill}
					disabled={terminal?.status === 'exited' || killTerminal.isPending}
					title="Kill terminal"
				>
					<X className="w-4 h-4" />
				</Button>
			</div>

			<div ref={termRef} className="flex-1 bg-[#1e1e1e] p-2" />
		</div>
	);
});
