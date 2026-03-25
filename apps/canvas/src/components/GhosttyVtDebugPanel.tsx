import { Terminal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	createGhosttyVtSession,
	destroyGhosttyVtSession,
	getGhosttyVtStatus,
	resizeGhosttyVtSession,
	sendGhosttyVtText,
	snapshotGhosttyVtSession,
	type GhosttyVtSnapshot,
	type GhosttyVtStatus,
} from '../lib/ghostty-vt';
import { isTauriRuntime } from '../lib/ghostty';

const SESSION_ID = 'canvas-libghostty-vt-prototype';

interface GhosttyVtDebugPanelProps {
	defaultCwd?: string | null;
}

export function GhosttyVtDebugPanel({ defaultCwd }: GhosttyVtDebugPanelProps) {
	const [open, setOpen] = useState(true);
	const [status, setStatus] = useState<GhosttyVtStatus | null>(null);
	const [statusError, setStatusError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [snapshot, setSnapshot] = useState<GhosttyVtSnapshot | null>(null);
	const [snapshotError, setSnapshotError] = useState<string | null>(null);
	const [cwd, setCwd] = useState(defaultCwd ?? '');
	const [command, setCommand] = useState('exec $SHELL');
	const [cols, setCols] = useState('80');
	const [rows, setRows] = useState('24');
	const [input, setInput] = useState('pwd');

	useEffect(() => {
		if (!defaultCwd) return;
		setCwd((current) => (current ? current : defaultCwd));
	}, [defaultCwd]);

	useEffect(() => {
		if (!isTauriRuntime()) {
			setStatus({
				available: false,
				message: 'The libghostty-vt prototype is available only in the Canvas Tauri app.',
			});
			return;
		}

		let cancelled = false;
		void getGhosttyVtStatus()
			.then((nextStatus) => {
				if (cancelled) return;
				setStatus(nextStatus);
			})
			.catch((error) => {
				if (cancelled) return;
				setStatusError(error instanceof Error ? error.message : String(error));
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const refreshSnapshot = useCallback(async () => {
		setSnapshotError(null);
		const nextSnapshot = await snapshotGhosttyVtSession(SESSION_ID);
		setSnapshot(nextSnapshot);
		return nextSnapshot;
	}, []);

	useEffect(() => {
		if (!snapshot?.processAlive) return;
		const interval = window.setInterval(() => {
			void refreshSnapshot().catch(() => undefined);
		}, 1200);
		return () => {
			window.clearInterval(interval);
		};
	}, [refreshSnapshot, snapshot?.processAlive]);

	const unavailableMessage = useMemo(() => {
		if (statusError) return statusError;
		if (!status) return 'Checking libghostty-vt status…';
		if (!status.available) return status.message;
		return null;
	}, [status, statusError]);

	const runAction = useCallback(async (action: () => Promise<void>) => {
		setBusy(true);
		setSnapshotError(null);
		try {
			await action();
		} catch (error) {
			setSnapshotError(error instanceof Error ? error.message : String(error));
		} finally {
			setBusy(false);
		}
	}, []);

	const handleCreate = useCallback(() => {
		void runAction(async () => {
			await createGhosttyVtSession(SESSION_ID, {
				cwd: cwd || undefined,
				command: command || undefined,
				cols: Number(cols) || 80,
				rows: Number(rows) || 24,
			});
			await refreshSnapshot();
		});
	}, [cols, command, cwd, refreshSnapshot, rows, runAction]);

	const handleResize = useCallback(() => {
		void runAction(async () => {
			await resizeGhosttyVtSession(SESSION_ID, {
				cols: Number(cols) || 80,
				rows: Number(rows) || 24,
				cellWidthPx: 8,
				cellHeightPx: 16,
			});
			await refreshSnapshot();
		});
	}, [cols, refreshSnapshot, rows, runAction]);

	const handleSend = useCallback(() => {
		const text = input.endsWith('\n') ? input : `${input}\n`;
		void runAction(async () => {
			await sendGhosttyVtText(SESSION_ID, text);
			setInput('');
			window.setTimeout(() => {
				void refreshSnapshot().catch(() => undefined);
			}, 150);
		});
	}, [input, refreshSnapshot, runAction]);

	const handleDestroy = useCallback(() => {
		void runAction(async () => {
			await destroyGhosttyVtSession(SESSION_ID);
			setSnapshot(null);
		});
	}, [runAction]);

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="fixed right-4 bottom-4 z-[70] inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-black/80 px-3 py-2 text-[11px] text-cyan-100 shadow-lg backdrop-blur"
			>
				<Terminal size={14} />
				VT Prototype
			</button>
		);
	}

	return (
		<div className="fixed right-4 bottom-4 z-[70] flex w-[420px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#05070a]/95 shadow-2xl backdrop-blur-xl">
			<div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
				<div className="flex items-center gap-2 text-[12px] font-medium text-cyan-100">
					<Terminal size={14} />
					libghostty-vt prototype
				</div>
				<div className="ml-auto flex items-center gap-2">
					{status?.available ? (
						<span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
							ready
						</span>
					) : null}
					<button
						type="button"
						onClick={() => setOpen(false)}
						className="rounded-full p-1 text-canvas-text-muted transition-colors hover:bg-white/10 hover:text-canvas-text"
					>
						<X size={14} />
					</button>
				</div>
			</div>

			<div className="space-y-3 p-3 text-[11px] text-canvas-text-muted">
				<p className="leading-5">
					Use this panel to create a PTY-backed libghostty-vt session, send shell input,
					and inspect the formatted screen snapshot.
				</p>

				{status?.message ? (
					<p className="rounded-xl border border-white/8 bg-white/5 px-2.5 py-2 leading-5 text-canvas-text-dim">
						{status.message}
					</p>
				) : null}

				{unavailableMessage ? (
					<p className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-2.5 py-2 leading-5 text-amber-100">
						{unavailableMessage}
					</p>
				) : (
					<>
						<div className="grid grid-cols-2 gap-2">
							<label className="col-span-2 flex flex-col gap-1">
								<span className="text-[10px] uppercase tracking-[0.12em] text-canvas-text-muted">
									Working directory
								</span>
								<input
									value={cwd}
									onChange={(event) => setCwd(event.target.value)}
									placeholder="/path/to/project"
									className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-canvas-text outline-none placeholder:text-canvas-text-muted"
								/>
							</label>
							<label className="col-span-2 flex flex-col gap-1">
								<span className="text-[10px] uppercase tracking-[0.12em] text-canvas-text-muted">
									Startup command
								</span>
								<input
									value={command}
									onChange={(event) => setCommand(event.target.value)}
									placeholder="exec $SHELL"
									className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-canvas-text outline-none placeholder:text-canvas-text-muted"
								/>
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-[10px] uppercase tracking-[0.12em] text-canvas-text-muted">
									Cols
								</span>
								<input
									value={cols}
									onChange={(event) => setCols(event.target.value)}
									inputMode="numeric"
									className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-canvas-text outline-none"
								/>
							</label>
							<label className="flex flex-col gap-1">
								<span className="text-[10px] uppercase tracking-[0.12em] text-canvas-text-muted">
									Rows
								</span>
								<input
									value={rows}
									onChange={(event) => setRows(event.target.value)}
									inputMode="numeric"
									className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-canvas-text outline-none"
								/>
							</label>
						</div>

						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								onClick={handleCreate}
								disabled={busy}
								className="rounded-full bg-cyan-500 px-3 py-1.5 text-[11px] font-medium text-black disabled:opacity-50"
							>
								Create session
							</button>
							<button
								type="button"
								onClick={() => void runAction(async () => void (await refreshSnapshot()))}
								disabled={busy}
								className="rounded-full border border-white/10 px-3 py-1.5 text-canvas-text disabled:opacity-50"
							>
								Refresh snapshot
							</button>
							<button
								type="button"
								onClick={handleResize}
								disabled={busy}
								className="rounded-full border border-white/10 px-3 py-1.5 text-canvas-text disabled:opacity-50"
							>
								Resize
							</button>
							<button
								type="button"
								onClick={handleDestroy}
								disabled={busy}
								className="rounded-full border border-rose-400/20 px-3 py-1.5 text-rose-200 disabled:opacity-50"
							>
								Destroy
							</button>
						</div>

						<div className="flex gap-2">
							<input
								value={input}
								onChange={(event) => setInput(event.target.value)}
								placeholder="Type shell input"
								className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-canvas-text outline-none placeholder:text-canvas-text-muted"
								onKeyDown={(event) => {
									if (event.key === 'Enter' && !busy) {
										event.preventDefault();
										handleSend();
									}
								}}
							/>
							<button
								type="button"
								onClick={handleSend}
								disabled={busy || !input.trim()}
								className="rounded-full border border-white/10 px-3 py-1.5 text-canvas-text disabled:opacity-50"
							>
								Send
							</button>
						</div>

						{snapshotError ? (
							<p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-2.5 py-2 leading-5 text-rose-100">
								{snapshotError}
							</p>
						) : null}

						<div className="space-y-2">
							<div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-canvas-text-muted">
								<span>Snapshot</span>
								{snapshot ? (
									<span>
										{snapshot.cols}×{snapshot.rows}
										{snapshot.processAlive ? ' • running' : ' • exited'}
										{snapshot.exitStatus !== null && snapshot.exitStatus !== undefined
											? ` • status ${snapshot.exitStatus}`
											: ''}
									</span>
								) : null}
							</div>
							<pre className="h-56 overflow-auto rounded-xl border border-white/10 bg-black/60 p-3 font-mono text-[11px] leading-5 text-cyan-100">
								{snapshot?.screenText || 'No snapshot yet.'}
							</pre>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
