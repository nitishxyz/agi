import { openUrl as openExternalUrl } from '@tauri-apps/plugin-opener';
import {
	ArrowLeft,
	ArrowRight,
	ExternalLink,
	Globe,
	LoaderCircle,
	RotateCw,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { isTauriRuntime } from '../lib/ghostty';
import {
	useNativeBlockHost,
	useNativeBlockRuntime,
} from '../lib/native-block-runtime';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';

const QUICK_LINKS = [
	'http://localhost:3000',
	'http://localhost:5173',
	'http://localhost:8000',
	'http://localhost:8080',
] as const;

function normalizeBrowserUrl(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return '';
	if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed)) return trimmed;
	if (trimmed.startsWith('//')) return `https:${trimmed}`;
	if (
		trimmed.startsWith('localhost') ||
		trimmed.startsWith('127.0.0.1') ||
		/^[\w.-]+:\d+(\/.*)?$/.test(trimmed)
	) {
		return `http://${trimmed}`;
	}
	return `https://${trimmed}`;
}

async function openUrl(url: string) {
	if (!url) return;
	if (isTauriRuntime()) {
		await openExternalUrl(url);
		return;
	}
	window.open(url, '_blank', 'noopener,noreferrer');
}

function IconButton({
	onClick,
	title,
	disabled,
	children,
}: {
	onClick: () => void;
	title: string;
	disabled?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			title={title}
			disabled={disabled}
			className="flex h-7 w-7 items-center justify-center rounded-md text-canvas-text-muted transition-colors hover:bg-white/[0.06] hover:text-canvas-text-dim disabled:cursor-not-allowed disabled:opacity-40"
		>
			{children}
		</button>
	);
}

function BrowserEmptyState({ onNavigate }: { onNavigate: (url: string) => void }) {
	return (
		<div className="flex h-full items-center justify-center px-6">
			<div className="max-w-md space-y-4 text-center">
				<div className="space-y-2">
					<Globe size={28} className="mx-auto text-canvas-text-muted" strokeWidth={1.25} />
					<p className="text-[13px] font-medium text-canvas-text-dim">
						Open a preview, docs page, or dashboard
					</p>
					<p className="text-[11px] text-canvas-text-muted">
						Browser blocks render in a native macOS web view hosted alongside Ghostty blocks.
					</p>
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2">
					{QUICK_LINKS.map((url) => (
						<button
							key={url}
							onClick={() => onNavigate(url)}
							className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-canvas-text-muted transition-colors hover:bg-white/[0.06] hover:text-canvas-text-dim"
						>
							{url.replace('http://', '')}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

function BrowserUnavailable({
	title,
	message,
	url,
}: {
	title: string;
	message: string;
	url?: string;
}) {
	return (
		<div className="flex h-full items-center justify-center px-6">
			<div className="max-w-md space-y-4 text-center">
				<div className="space-y-2">
					<Globe size={24} className="mx-auto text-black/60" strokeWidth={1.25} />
					<p className="text-[13px] font-medium text-black/80">{title}</p>
					<p className="text-[11px] text-black/55">{message}</p>
				</div>
				{url && (
					<div className="flex items-center justify-center gap-2">
						<button
							onClick={() => void openUrl(url)}
							className="rounded-md bg-black px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-black/85"
						>
							Open externally
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

export function BrowserBlock({ block }: { block: Block }) {
	const hostRef = useNativeBlockHost(block.id, 'browser');
	const runtime = useNativeBlockRuntime(block.id);
	const setBlockUrl = useCanvasStore((s) => s.setBlockUrl);
	const reloadBlock = useCanvasStore((s) => s.reloadBlock);
	const [draftUrl, setDraftUrl] = useState(block.url ?? '');
	const [historyIndex, setHistoryIndex] = useState(block.url ? 0 : -1);
	const historyRef = useRef<string[]>(block.url ? [block.url] : []);
	const nativeMode = isTauriRuntime();

	useEffect(() => {
		setDraftUrl(block.url ?? '');
	}, [block.url]);

	const navigate = useCallback(
		(value: string, options?: { record?: boolean }) => {
			const nextUrl = normalizeBrowserUrl(value);
			if (!nextUrl) return;

			setDraftUrl(nextUrl);
			if (options?.record !== false) {
				const current = historyIndex >= 0 ? historyRef.current[historyIndex] : null;
				if (current !== nextUrl) {
					const nextHistory = historyRef.current.slice(0, historyIndex + 1);
					nextHistory.push(nextUrl);
					historyRef.current = nextHistory;
					setHistoryIndex(nextHistory.length - 1);
				}
			}

			setBlockUrl(block.id, nextUrl);
		},
		[block.id, historyIndex, setBlockUrl],
	);

	const goHistory = useCallback(
		(offset: -1 | 1) => {
			const nextIndex = historyIndex + offset;
			if (nextIndex < 0 || nextIndex >= historyRef.current.length) return;
			const nextUrl = historyRef.current[nextIndex];
			setHistoryIndex(nextIndex);
			void navigate(nextUrl, { record: false });
		},
		[historyIndex, navigate],
	);

	const reload = useCallback(() => {
		if (!block.url) return;
		reloadBlock(block.id);
	}, [block.id, block.url, reloadBlock]);

	return (
		<div className="flex h-full w-full flex-col bg-[rgba(10,10,12,0.92)]">
			<div className="flex items-center gap-2 border-b border-canvas-border px-2 py-1.5">
				<IconButton
					onClick={() => goHistory(-1)}
					title="Back"
					disabled={historyIndex <= 0}
				>
					<ArrowLeft size={13} />
				</IconButton>
				<IconButton
					onClick={() => goHistory(1)}
					title="Forward"
					disabled={historyIndex < 0 || historyIndex >= historyRef.current.length - 1}
				>
					<ArrowRight size={13} />
				</IconButton>
				<IconButton
					onClick={reload}
					title="Reload"
					disabled={!block.url || runtime.loading}
				>
					<RotateCw size={13} />
				</IconButton>
				<form
					className="flex-1"
					onSubmit={(event) => {
						event.preventDefault();
						void navigate(draftUrl);
					}}
				>
					<input
						value={draftUrl}
						onChange={(event) => setDraftUrl(event.target.value)}
						placeholder="Enter a URL or localhost port"
						className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-[12px] text-canvas-text outline-none transition-colors placeholder:text-canvas-text-muted focus:border-canvas-border-active"
						autoCapitalize="off"
						autoCorrect="off"
						spellCheck={false}
					/>
				</form>
				<IconButton
					onClick={() => {
						if (!block.url) return;
						void openUrl(block.url);
					}}
					title="Open externally"
					disabled={!block.url}
				>
					<ExternalLink size={13} />
				</IconButton>
			</div>

			<div className="relative flex-1 min-h-0 bg-white">
				{runtime.loading && (
					<>
						<div className="absolute inset-x-0 top-0 h-[2px] bg-black/5" />
						<div className="absolute left-0 top-0 h-[2px] w-1/3 animate-[browser-load_1.15s_ease-in-out_infinite] bg-canvas-accent" />
						<div className="absolute right-3 top-3 flex items-center gap-1 rounded-md border border-black/10 bg-white/90 px-2 py-1 text-[10px] font-medium text-black/60 shadow-sm">
							<LoaderCircle size={11} className="animate-spin" />
							<span>Loading page</span>
						</div>
					</>
				)}

				{!nativeMode ? (
					<BrowserUnavailable
						title="Browser blocks require the Canvas desktop runtime"
						message="This block is native-only. apps/canvas renders browser content through a native platform web view."
						url={block.url}
					/>
				) : !block.url ? (
					<BrowserEmptyState onNavigate={(url) => void navigate(url)} />
				) : (
					<div
						ref={hostRef}
						data-native-block-host="browser"
						data-block-id={block.id}
						className="h-full w-full"
					>
						{runtime.error && (
							<BrowserUnavailable
								title="Browser block unavailable"
								message={runtime.error}
								url={block.url}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
