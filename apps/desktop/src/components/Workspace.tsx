import { useState, useEffect, useRef, useCallback } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useServer } from '../hooks/useServer';
import { useFullscreen } from '../hooks/useFullscreen';
import { handleTitleBarDrag } from '../utils/title-bar';
import type { Project } from '../lib/tauri-bridge';

const DARK_BG = 'hsl(240, 10%, 8%)';

export function Workspace({
	project,
	onBack,
}: {
	project: Project;
	onBack: () => void;
}) {
	const { server, loading, error, startServer, stopServer } = useServer();
	const startedRef = useRef(false);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [iframeLoaded, setIframeLoaded] = useState(false);
	const isFullscreen = useFullscreen();

	const handleBack = async () => {
		await stopServer();
		onBack();
	};

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;
		console.log(
			'[AGI] Workspace mounting for project:',
			project.path,
			project.name,
		);
		startServer(project.path);
	}, [project.path, project.name, startServer]);

	useEffect(() => {
		if (!server) setIframeLoaded(false);
	}, [server]);

	const focusIframe = useCallback(() => {
		iframeRef.current?.contentWindow?.focus();
	}, []);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInIframe = target.ownerDocument !== document;
			if (isInIframe) return;

			const isInteractive = target.closest('button, a, input, [role="button"]');
			if (isInteractive) return;

			focusIframe();
		};
		document.addEventListener('keydown', handler);
		return () => document.removeEventListener('keydown', handler);
	}, [focusIframe]);

	useEffect(() => {
		const handler = (e: MessageEvent) => {
			if (e.data?.type === 'agi-open-url' && typeof e.data.url === 'string') {
				openUrl(e.data.url).catch((err: unknown) => {
					console.error('[AGI] Failed to open URL:', err);
				});
			}
		};
		window.addEventListener('message', handler);
		return () => window.removeEventListener('message', handler);
	}, []);

	return (
		<div
			className="h-screen flex flex-col"
			style={{ backgroundColor: DARK_BG }}
		>
			<div
				className="flex items-center gap-2 px-4 h-10 border-b border-border cursor-default select-none"
				style={{ backgroundColor: DARK_BG }}
				onMouseDown={handleTitleBarDrag}
				data-tauri-drag-region
				role="toolbar"
			>
				<button
					type="button"
					onClick={handleBack}
					className={`w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors ${isFullscreen ? '' : 'ml-16'}`}
				>
					←
				</button>
				<div className="flex-1 min-w-0 flex items-center gap-2">
					<span className="font-medium text-foreground truncate">
						{project.name}
					</span>
					<span className="text-xs text-muted-foreground truncate">
						{project.path}
					</span>
				</div>
				{server && (
					<div className="flex items-center gap-1.5 text-xs">
						<span className="w-2 h-2 rounded-full bg-green-500" />
						<span className="text-muted-foreground">Port {server.webPort}</span>
					</div>
				)}
			</div>

			<div
				className="flex-1 relative flex items-center justify-center"
				style={{ backgroundColor: DARK_BG }}
			>
				{(loading || (server && !iframeLoaded)) && (
					<div className="text-center">
						<div className="text-muted-foreground mb-2">
							{loading ? 'Starting server...' : 'Loading...'}
						</div>
					</div>
				)}
				{error && !loading && (
					<div className="text-center max-w-md">
						<div className="text-destructive mb-4">{error}</div>
						<button
							type="button"
							onClick={() => {
								startedRef.current = false;
								startServer(project.path);
							}}
							className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
						>
							Retry
						</button>
					</div>
				)}
				{server && (
					<iframe
						ref={iframeRef}
						src={`${server.url}?_t=${Date.now()}&_pid=${server.pid}&_project=${encodeURIComponent(project.path)}`}
						className={`absolute inset-0 w-full h-full border-none transition-opacity duration-200 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
						style={{ backgroundColor: DARK_BG }}
						title="AGI Workspace"
						allow="clipboard-write; clipboard-read"
						onLoad={() => {
							setIframeLoaded(true);
							focusIframe();
						}}
					/>
				)}
			</div>
		</div>
	);
}
