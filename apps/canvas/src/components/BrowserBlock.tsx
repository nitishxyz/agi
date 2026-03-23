import { openUrl as openExternalUrl } from '@tauri-apps/plugin-opener';
import type { Webview } from '@tauri-apps/api/webview';
import {
	ArrowLeft,
	ArrowRight,
	ExternalLink,
	Globe,
	LoaderCircle,
	RotateCw,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
	createBrowserWebview,
	destroyBrowserWebview,
	getBrowserUserAgent,
	updateBrowserWebviewBounds,
} from '../lib/browser-webview';
import { isTauriRuntime } from '../lib/ghostty';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';

const QUICK_LINKS = [
	'http://localhost:3000',
	'http://localhost:5173',
	'http://localhost:8000',
	'http://localhost:8080',
] as const;

const MIN_LOADING_UI_MS = 900;

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
						Browser blocks are native Tauri child webviews. Localhost previews and normal sites should load directly here.
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

function BrowserUnavailable({ title, message, url }: { title: string; message: string; url?: string }) {
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
	const nativeContainerRef = useRef<HTMLDivElement>(null);
	const nativeWebviewRef = useRef<Webview | null>(null);
	const historyRef = useRef<string[]>(block.url ? [block.url] : []);
	const loadingStartedAtRef = useRef<number>(0);
	const loadingGenerationRef = useRef(0);
	const loadingTimerRef = useRef<number | null>(null);
	const setBlockUrl = useCanvasStore((s) => s.setBlockUrl);
	const [draftUrl, setDraftUrl] = useState(block.url ?? '');
	const [refreshKey, setRefreshKey] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [historyIndex, setHistoryIndex] = useState(block.url ? 0 : -1);
	const nativeMode = isTauriRuntime();

	useEffect(() => {
		setDraftUrl(block.url ?? '');
	}, [block.url]);

	const clearLoadingTimer = useCallback(() => {
		if (loadingTimerRef.current !== null) {
			window.clearTimeout(loadingTimerRef.current);
			loadingTimerRef.current = null;
		}
	}, []);

	const beginLoading = useCallback(() => {
		clearLoadingTimer();
		loadingStartedAtRef.current = Date.now();
		setIsLoading(true);
	}, [clearLoadingTimer]);

	const finishLoading = useCallback(
		(generation: number) => {
			if (generation !== loadingGenerationRef.current) return;
			const elapsed = Date.now() - loadingStartedAtRef.current;
			const remaining = Math.max(0, MIN_LOADING_UI_MS - elapsed);

			clearLoadingTimer();
			loadingTimerRef.current = window.setTimeout(() => {
				if (generation !== loadingGenerationRef.current) return;
				loadingTimerRef.current = null;
				setIsLoading(false);
			}, remaining);
		},
		[clearLoadingTimer],
	);

	const navigate = useCallback(
		(value: string, options?: { record?: boolean }) => {
			const nextUrl = normalizeBrowserUrl(value);
			if (!nextUrl) return;

			beginLoading();
			setDraftUrl(nextUrl);
			setErrorMessage(null);

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
		[beginLoading, block.id, historyIndex, setBlockUrl],
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

	const stopLoading = useCallback(() => {
		loadingGenerationRef.current += 1;
		clearLoadingTimer();
		const current = nativeWebviewRef.current;
		if (!current) {
			setIsLoading(false);
			return;
		}
		nativeWebviewRef.current = null;
		setIsLoading(false);
		setErrorMessage('Loading stopped. Press reload to try again.');
		void current.close().catch((error) => {
			console.debug('[browser] failed to stop child webview', error);
		});
	}, [clearLoadingTimer]);

	const syncNativeBounds = useCallback(async () => {
		if (!nativeWebviewRef.current || !nativeContainerRef.current) return;

		const rect = nativeContainerRef.current.getBoundingClientRect();
		if (rect.width < 1 || rect.height < 1) return;

		await updateBrowserWebviewBounds(nativeWebviewRef.current, {
			x: rect.left,
			y: rect.top,
			width: rect.width,
			height: rect.height,
		}).catch((error) => {
			console.debug('[browser] failed to update child webview bounds', error);
		});
	}, []);

	useEffect(() => {
		if (!nativeMode || !block.url) return;

		const element = nativeContainerRef.current;
		if (!element) return;

		const sync = () => {
			void syncNativeBounds();
		};

		sync();

		const observer = new ResizeObserver(sync);
		observer.observe(element);
		window.addEventListener('resize', sync);

		return () => {
			observer.disconnect();
			window.removeEventListener('resize', sync);
		};
	}, [block.url, nativeMode, syncNativeBounds]);

	useEffect(() => {
		if (!nativeMode) return;

		if (!block.url) {
			loadingGenerationRef.current += 1;
			clearLoadingTimer();
			setIsLoading(false);
			setErrorMessage(null);
			void destroyBrowserWebview(block.id);
			return;
		}

		const generation = ++loadingGenerationRef.current;
		const currentUrl = block.url;
		let cancelled = false;
		beginLoading();
		setErrorMessage(null);

		const createNativeView = async () => {
			const element = nativeContainerRef.current;
			if (!element) {
				window.requestAnimationFrame(() => {
					void createNativeView();
				});
				return;
			}

			const rect = element.getBoundingClientRect();
			if (rect.width < 1 || rect.height < 1) {
				window.requestAnimationFrame(() => {
					void createNativeView();
				});
				return;
			}

			try {
				const webview = await createBrowserWebview(
					block.id,
					currentUrl,
					{
						x: rect.left,
						y: rect.top,
						width: rect.width,
						height: rect.height,
					},
					false,
					getBrowserUserAgent(window.navigator.userAgent),
				);

				if (cancelled) {
					await webview.close().catch(() => undefined);
					return;
				}

				nativeWebviewRef.current = webview;
				finishLoading(generation);
				setErrorMessage(null);
			} catch (error) {
				if (cancelled) return;
				console.debug('[browser] failed to create child webview', error);
				finishLoading(generation);
				setErrorMessage(
					error instanceof Error
						? error.message
						: 'Failed to create native browser webview.',
				);
			}
		};

		void createNativeView();

		return () => {
			cancelled = true;
			clearLoadingTimer();
			nativeWebviewRef.current = null;
			void destroyBrowserWebview(block.id);
		};
	}, [beginLoading, block.id, block.url, clearLoadingTimer, finishLoading, nativeMode, refreshKey]);

	useEffect(() => {
		return () => {
			clearLoadingTimer();
		};
	}, [clearLoadingTimer]);

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
					onClick={() => {
						if (isLoading) {
							stopLoading();
							return;
						}
						setRefreshKey((value) => value + 1);
					}}
					title={isLoading ? 'Stop loading' : 'Reload'}
					disabled={!block.url}
				>
					{isLoading ? <X size={13} /> : <RotateCw size={13} />}
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
				{isLoading && (
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
						message="This block is native-only. apps/canvas renders browser content through a Tauri child webview, with no iframe fallback. Tauri uses system webviews; see the Tauri webview versions reference for platform differences."
						url={block.url}
					/>
				) : !block.url ? (
					<BrowserEmptyState onNavigate={(url) => void navigate(url)} />
				) : (
					<div ref={nativeContainerRef} className="h-full w-full">
						{errorMessage && (
							<BrowserUnavailable
								title="Browser block unavailable"
								message={errorMessage}
								url={block.url}
							/>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
