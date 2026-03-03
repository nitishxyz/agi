import { useKeyboard, useRenderer } from '@opentui/react';
import { TextareaRenderable } from '@opentui/core';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
	getGitStatus,
	stageFiles,
	generateCommitMessage,
	commitChanges,
} from '@ottocode/api';
import { useTheme } from '../theme.ts';

interface GitFileInfo {
	path: string;
	status: string;
}

interface CommitOverlayProps {
	onClose: () => void;
	onCommitted: () => void;
}

type Phase =
	| 'loading'
	| 'idle'
	| 'generating'
	| 'committing'
	| 'done'
	| 'error';

export function CommitOverlay({ onClose, onCommitted }: CommitOverlayProps) {
	const { colors } = useTheme();
	const renderer = useRenderer();
	const [phase, setPhase] = useState<Phase>('loading');
	const [staged, setStaged] = useState<GitFileInfo[]>([]);
	const [unstaged, setUnstaged] = useState<GitFileInfo[]>([]);
	const [untracked, setUntracked] = useState<GitFileInfo[]>([]);
	const [message, setMessage] = useState('');
	const [errorText, setErrorText] = useState('');
	const [statusText, setStatusText] = useState('');
	const textareaRef = useRef<TextareaRenderable | null>(null);
	const containerRef = useRef<string>(`commit-msg-${Date.now()}`);
	const phaseRef = useRef(phase);
	phaseRef.current = phase;

	const loadStatus = useCallback(async () => {
		try {
			const res = await getGitStatus();
			// biome-ignore lint/suspicious/noExplicitAny: SDK response type
			const data = (res.data as any)?.data;
			if (data) {
				setStaged(data.staged || []);
				setUnstaged(data.unstaged || []);
				setUntracked(data.untracked || []);
			}
			setPhase('idle');
		} catch {
			setErrorText('Failed to load git status');
			setPhase('error');
		}
	}, []);

	useEffect(() => {
		loadStatus();
	}, [loadStatus]);

	const stagedRef = useRef(staged);
	stagedRef.current = staged;
	const unstagedRef = useRef(unstaged);
	unstagedRef.current = unstaged;
	const untrackedRef = useRef(untracked);
	untrackedRef.current = untracked;

	const handleGenerate = useCallback(async () => {
		setPhase('generating');
		setErrorText('');
		setStatusText('Generating commit message…');
		try {
			const hasUnstaged =
				unstagedRef.current.length > 0 || untrackedRef.current.length > 0;
			if (stagedRef.current.length === 0 && hasUnstaged) {
				setStatusText('Staging files…');
				// biome-ignore lint/suspicious/noExplicitAny: SDK body type mismatch
				await stageFiles({ body: { files: ['.'] } as any });
				await loadStatus();
				setStatusText('Generating commit message…');
			}
			const res = await generateCommitMessage({ body: {} });
			// biome-ignore lint/suspicious/noExplicitAny: SDK response type
			if ((res as any).error) {
				// biome-ignore lint/suspicious/noExplicitAny: SDK error type
				const errData = (res as any).error;
				throw new Error(
					errData?.error || errData?.message || 'Unknown API error',
				);
			}
			// biome-ignore lint/suspicious/noExplicitAny: SDK response type
			const data = (res.data as any)?.data;
			const msg = data?.message;
			if (msg && textareaRef.current) {
				setMessage(msg);
				textareaRef.current.editBuffer.setText(msg);
				textareaRef.current.editBuffer.setCursorByOffset(msg.length);
				textareaRef.current.focus();
			} else if (!msg) {
				throw new Error('No commit message returned');
			}
			setStatusText('');
			setPhase('idle');
		} catch (err) {
			setErrorText(
				`Generate failed: ${err instanceof Error ? err.message : 'unknown error'}`,
			);
			setStatusText('');
			setPhase('idle');
		}
	}, [loadStatus]);

	const handleCommit = useCallback(async () => {
		const msg = textareaRef.current?.plainText.trim() || message.trim();
		if (!msg) {
			setErrorText('Enter a commit message first');
			return;
		}
		setPhase('committing');
		setErrorText('');
		setStatusText('Committing…');
		try {
			if (stagedRef.current.length === 0) {
				setStatusText('Staging files…');
				// biome-ignore lint/suspicious/noExplicitAny: SDK body type mismatch
				await stageFiles({ body: { files: ['.'] } as any });
				setStatusText('Committing…');
			}
			// biome-ignore lint/suspicious/noExplicitAny: SDK body type mismatch
			const commitRes = await commitChanges({ body: { message: msg } as any });
			// biome-ignore lint/suspicious/noExplicitAny: SDK error check
			if ((commitRes as any).error) {
				// biome-ignore lint/suspicious/noExplicitAny: SDK error type
				const errData = (commitRes as any).error;
				throw new Error(errData?.error || errData?.message || 'Commit failed');
			}
			setPhase('done');
			setStatusText('');
			onCommitted();
			setTimeout(onClose, 800);
		} catch (err) {
			setErrorText(
				`Commit failed: ${err instanceof Error ? err.message : 'unknown error'}`,
			);
			setStatusText('');
			setPhase('idle');
		}
	}, [message, onClose, onCommitted]);

	const handleContentChange = useCallback(() => {
		if (!textareaRef.current) return;
		setMessage(textareaRef.current.plainText);
	}, []);

	const tryCreateTextarea = useCallback(() => {
		if (textareaRef.current) return;
		const container = renderer.root.findDescendantById(containerRef.current);
		if (!container) return;

		const textarea = new TextareaRenderable(renderer, {
			id: 'commit-msg-textarea',
			width: '100%',
			height: 3,
			placeholder: 'Type commit message or press ⌃G to generate',
			placeholderColor: colors.fgDark,
			textColor: colors.fgBright,
			focusedTextColor: colors.fgBright,
			cursorColor: colors.blue,
			wrapMode: 'word',
			keyBindings: [],
		});

		textarea.onContentChange = handleContentChange;
		container.add(textarea);
		textareaRef.current = textarea;
		textarea.focus();
	}, [renderer, handleContentChange, colors]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run when phase changes so container becomes available
	useEffect(() => {
		tryCreateTextarea();
	}, [tryCreateTextarea, phase, staged, unstaged, untracked]);

	useEffect(() => {
		return () => {
			if (textareaRef.current) {
				textareaRef.current.destroy();
				textareaRef.current = null;
			}
		};
	}, []);

	const handleGenerateRef = useRef(handleGenerate);
	handleGenerateRef.current = handleGenerate;
	const handleCommitRef = useRef(handleCommit);
	handleCommitRef.current = handleCommit;

	useKeyboard((key) => {
		if (key.name === 'escape') {
			onClose();
		} else if (key.name === 'return' && key.ctrl) {
			if (phaseRef.current === 'idle') handleCommitRef.current();
		} else if (key.name === 'g' && key.ctrl) {
			if (phaseRef.current === 'idle') handleGenerateRef.current();
		}
	});

	const totalChanges = staged.length + unstaged.length + untracked.length;
	const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
	const [spinnerIdx, setSpinnerIdx] = useState(0);
	const isSpinning =
		phase === 'generating' || phase === 'committing' || phase === 'loading';

	useEffect(() => {
		if (!isSpinning) return;
		const iv = setInterval(
			() => setSpinnerIdx((i) => (i + 1) % SPINNER.length),
			80,
		);
		return () => clearInterval(iv);
	}, [isSpinning]);

	const statusColor = (s: string) => {
		if (s === 'added' || s === 'untracked') return colors.green;
		if (s === 'deleted') return colors.red;
		return colors.yellow;
	};

	const statusChar = (s: string) => {
		if (s === 'added' || s === 'untracked') return 'A';
		if (s === 'deleted') return 'D';
		if (s === 'renamed') return 'R';
		return 'M';
	};

	return (
		<box
			style={{
				position: 'absolute',
				top: Math.floor((process.stdout.rows ?? 40) * 0.1),
				left: Math.floor((process.stdout.columns ?? 120) * 0.15),
				right: Math.floor((process.stdout.columns ?? 120) * 0.15),
				border: true,
				borderStyle: 'rounded',
				borderColor: colors.border,
				backgroundColor: colors.bg,
				zIndex: 100,
				flexDirection: 'column',
				padding: 1,
			}}
			title=" Commit "
		>
			{phase === 'loading' && (
				<text fg={colors.blue}>{SPINNER[spinnerIdx]} Loading git status…</text>
			)}

			{phase === 'done' && (
				<text fg={colors.green}>✓ Committed successfully</text>
			)}

			{phase !== 'loading' && phase !== 'done' && (
				<box style={{ flexDirection: 'column' }}>
					{totalChanges === 0 && (
						<text fg={colors.fgDark}>No changes to commit</text>
					)}

					{staged.length > 0 && (
						<box style={{ flexDirection: 'column', marginBottom: 1 }}>
							<text fg={colors.green}>
								<b>Staged ({staged.length})</b>
							</text>
							{staged.slice(0, 8).map((f) => (
								<box
									key={f.path}
									style={{ flexDirection: 'row', gap: 1, height: 1 }}
								>
									<text fg={statusColor(f.status)}>{statusChar(f.status)}</text>
									<text fg={colors.fgMuted}>{f.path}</text>
								</box>
							))}
							{staged.length > 8 && (
								<text fg={colors.fgDark}> …and {staged.length - 8} more</text>
							)}
						</box>
					)}

					{unstaged.length > 0 && (
						<box style={{ flexDirection: 'column', marginBottom: 1 }}>
							<text fg={colors.yellow}>
								<b>Unstaged ({unstaged.length})</b>
							</text>
							{unstaged.slice(0, 5).map((f) => (
								<box
									key={f.path}
									style={{ flexDirection: 'row', gap: 1, height: 1 }}
								>
									<text fg={statusColor(f.status)}>{statusChar(f.status)}</text>
									<text fg={colors.fgDark}>{f.path}</text>
								</box>
							))}
							{unstaged.length > 5 && (
								<text fg={colors.fgDark}> …and {unstaged.length - 5} more</text>
							)}
						</box>
					)}

					{untracked.length > 0 && (
						<box style={{ flexDirection: 'column', marginBottom: 1 }}>
							<text fg={colors.fgDark}>
								<b>Untracked ({untracked.length})</b>
							</text>
							{untracked.slice(0, 3).map((f) => (
								<box
									key={f.path}
									style={{ flexDirection: 'row', gap: 1, height: 1 }}
								>
									<text fg={colors.fgDark}>?</text>
									<text fg={colors.fgDark}>{f.path}</text>
								</box>
							))}
							{untracked.length > 3 && (
								<text fg={colors.fgDark}>
									{' '}
									…and {untracked.length - 3} more
								</text>
							)}
						</box>
					)}

					<box style={{ flexDirection: 'column', marginTop: 1 }}>
						<box style={{ flexDirection: 'row', gap: 1 }}>
							<text fg={colors.fgDimmed}>Commit message:</text>
							{statusText && (
								<text fg={colors.yellow}>
									{SPINNER[spinnerIdx]} {statusText}
								</text>
							)}
						</box>
						<box
							style={{
								width: '100%',
								height: 5,
								flexShrink: 0,
								border: true,
								borderStyle: 'rounded',
								borderColor:
									phase === 'generating' ? colors.yellow : colors.border,
							}}
						>
							<box
								id={containerRef.current}
								style={{ width: '100%', height: 3 }}
							/>
						</box>
					</box>

					{errorText && <text fg={colors.red}>{errorText}</text>}
				</box>
			)}

			{phase !== 'loading' && phase !== 'done' && (
				<text fg={colors.fgDimmed}>⌃G generate · ⌃↵ commit · esc close</text>
			)}
		</box>
	);
}
