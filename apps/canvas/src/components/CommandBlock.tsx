import { getCurrentWebview } from '@tauri-apps/api/webview';
import { Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { GhosttyBlock } from './GhosttyBlock';

interface CommandBlockProps {
	block: Block;
	isFocused: boolean;
}

function deriveCommandLabel(command: string) {
	const trimmed = command.trim();
	if (!trimmed) return 'Command';
	return trimmed;
}

export function CommandBlock({ block, isFocused }: CommandBlockProps) {
	const setFocused = useCanvasStore((s) => s.setFocused);
	const setCommandBlockConfig = useCanvasStore((s) => s.setCommandBlockConfig);
	const [label, setLabel] = useState(block.label === 'Command' ? '' : block.label);
	const [command, setCommand] = useState(block.command ?? '');
	const [cwd, setCwd] = useState(block.cwd ?? '');
	const commandInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		setLabel(block.label === 'Command' ? '' : block.label);
		setCommand(block.command ?? '');
		setCwd(block.cwd ?? '');
	}, [block.command, block.cwd, block.label]);

	useEffect(() => {
		if (!isFocused || (block.command?.trim() ?? '').length > 0) return;
		window.setTimeout(() => {
			void getCurrentWebview().setFocus().catch(() => undefined);
			commandInputRef.current?.focus();
			window.focus();
		}, 0);
	}, [block.command, isFocused]);

	const helperText = useMemo(() => {
		if (cwd.trim()) return `Runs in ${cwd.trim()} (relative paths resolve from the workspace root)`;
		return 'Runs in the current workspace root unless you override the working directory.';
	}, [cwd]);

	if ((block.command?.trim() ?? '').length > 0) {
		return <GhosttyBlock block={block} isFocused={isFocused} />;
	}

	return (
		<div
			className="flex h-full w-full items-center justify-center px-5"
			onMouseDownCapture={() => setFocused(block.id)}
		>
			<form
				className="w-full max-w-md space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
				onSubmit={(event) => {
					event.preventDefault();
					const nextCommand = command.trim();
					if (!nextCommand) return;
					setCommandBlockConfig(block.id, {
						label: label.trim() || deriveCommandLabel(nextCommand),
						command: nextCommand,
						cwd,
					});
				}}
			>
				<div className="space-y-2 text-center">
					<div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.05] text-canvas-text-muted">
						<Play size={16} strokeWidth={1.75} />
					</div>
					<div>
						<p className="text-[13px] font-medium text-canvas-text-dim">Configure command</p>
						<p className="mt-1 text-[11px] leading-5 text-canvas-text-muted">
							Launch a custom command in a libghostty-vt terminal block or tab.
						</p>
					</div>
				</div>

				<div className="space-y-1.5">
					<label className="text-[10px] uppercase tracking-[0.14em] text-canvas-text-muted">
						Label
					</label>
					<input
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						placeholder="Frontend dev"
						className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12px] text-canvas-text outline-none transition-colors placeholder:text-canvas-text-muted focus:border-canvas-border-active"
					/>
				</div>

				<div className="space-y-1.5">
					<label className="text-[10px] uppercase tracking-[0.14em] text-canvas-text-muted">
						Command
					</label>
					<input
						ref={commandInputRef}
						value={command}
						onChange={(event) => setCommand(event.target.value)}
						placeholder="bun run dev"
						autoCapitalize="off"
						autoCorrect="off"
						spellCheck={false}
						className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12px] text-canvas-text outline-none transition-colors placeholder:text-canvas-text-muted focus:border-canvas-border-active"
					/>
				</div>

				<div className="space-y-1.5">
					<label className="text-[10px] uppercase tracking-[0.14em] text-canvas-text-muted">
						Working directory override
					</label>
					<input
						value={cwd}
						onChange={(event) => setCwd(event.target.value)}
						placeholder="Leave empty to use workspace root"
						autoCapitalize="off"
						autoCorrect="off"
						spellCheck={false}
						className="h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-[12px] text-canvas-text outline-none transition-colors placeholder:text-canvas-text-muted focus:border-canvas-border-active"
					/>
					<p className="text-[10px] leading-5 text-canvas-text-muted">{helperText}</p>
				</div>

				<div className="flex justify-end">
					<button
						type="submit"
						disabled={!command.trim()}
						className="rounded-lg bg-canvas-accent px-3 py-2 text-[11px] font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Run command
					</button>
				</div>
			</form>
		</div>
	);
}
