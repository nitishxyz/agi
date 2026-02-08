import { useState, useEffect, useRef, useCallback } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useServer } from '../../hooks/useServer';
import { useFullscreen } from '../../hooks/useFullscreen';
import { usePlatform } from '../../hooks/usePlatform';
import { handleTitleBarDrag } from '../../utils/title-bar';
import { tauriOnboarding } from '../../lib/tauri-onboarding';
import { SetuLoader } from '../SetuLoader';
import { WindowControls } from '../WindowControls';
import { OnboardingModal, SetuTopupModal, Toaster } from '@ottocode/web-sdk';
import { configureApiClient } from '@ottocode/web-sdk/lib';
import { useOnboardingStore } from '@ottocode/web-sdk/stores';
import { useAuthStatus } from '@ottocode/web-sdk/hooks';

interface NativeOnboardingProps {
	onComplete: () => void;
}

export function NativeOnboarding({ onComplete }: NativeOnboardingProps) {
	const [serverReady, setServerReady] = useState(false);
	const [homePath, setHomePath] = useState<string | null>(null);
	const isFullscreen = useFullscreen();
	const platform = usePlatform();
	const currentStep = useOnboardingStore((s) => s.currentStep);
	const {
		server,
		loading: serverLoading,
		error: serverError,
		startServer,
		stopServer,
	} = useServer();
	const startedRef = useRef(false);
	const isOpen = useOnboardingStore((s) => s.isOpen);
	const { checkOnboarding, fetchAuthStatus } = useAuthStatus();
	const prevIsOpen = useRef(true);
	const oauthPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const oauthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const preOauthProvidersRef = useRef<Set<string>>(new Set());
	const authStatus = useOnboardingStore((s) => s.authStatus);

	const startOAuthPolling = useCallback(() => {
		if (oauthPollingRef.current) return;
		const status = useOnboardingStore.getState().authStatus;
		if (status) {
			preOauthProvidersRef.current = new Set(
				Object.entries(status.providers)
					.filter(([, p]) => p.configured)
					.map(([id]) => id),
			);
		}
		oauthPollingRef.current = setInterval(() => {
			fetchAuthStatus();
		}, 3000);
		oauthTimeoutRef.current = setTimeout(() => {
			if (oauthPollingRef.current) {
				clearInterval(oauthPollingRef.current);
				oauthPollingRef.current = null;
			}
		}, 300000);
	}, [fetchAuthStatus]);

	useEffect(() => {
		if (!authStatus || !oauthPollingRef.current) return;
		const hasNewProvider = Object.entries(authStatus.providers)
			.filter(([, p]) => p.configured)
			.some(([id]) => !preOauthProvidersRef.current.has(id));
		if (hasNewProvider) {
			clearInterval(oauthPollingRef.current);
			oauthPollingRef.current = null;
			if (oauthTimeoutRef.current) {
				clearTimeout(oauthTimeoutRef.current);
				oauthTimeoutRef.current = null;
			}
		}
	}, [authStatus]);

	useEffect(() => {
		return () => {
			if (oauthPollingRef.current) clearInterval(oauthPollingRef.current);
			if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
		};
	}, []);

	useEffect(() => {
		const originalOpen = window.open.bind(window);
		window.open = (
			url?: string | URL,
			_target?: string,
			_features?: string,
		) => {
			if (url) {
				const urlStr = typeof url === 'string' ? url : url.toString();
				openUrl(urlStr).catch((err: unknown) => {
					console.error('[otto] Failed to open URL:', err);
				});
				if (urlStr.includes('/oauth/') || urlStr.includes('/auth/')) {
					startOAuthPolling();
				}
			}
			return null;
		};
		return () => {
			window.open = originalOpen;
		};
	}, [startOAuthPolling]);

	useEffect(() => {
		tauriOnboarding
			.getHomeDirectory()
			.then(setHomePath)
			.catch(() => setHomePath('/tmp'));
	}, []);

	useEffect(() => {
		if (!homePath || startedRef.current) return;
		startedRef.current = true;
		startServer(homePath);
	}, [homePath, startServer]);

	useEffect(() => {
		if (!server) return;
		const win = window as Window & { OTTO_SERVER_URL?: string };
		win.OTTO_SERVER_URL = `http://localhost:${server.port}`;
		configureApiClient();
		setServerReady(true);
	}, [server]);

	useEffect(() => {
		if (serverReady) {
			checkOnboarding();
		}
	}, [serverReady, checkOnboarding]);

	useEffect(() => {
		if (prevIsOpen.current && !isOpen && serverReady) {
			stopServer().then(() => onComplete());
		}
		prevIsOpen.current = isOpen;
	}, [isOpen, serverReady, stopServer, onComplete]);

	useEffect(() => {
		const handler = (e: MessageEvent) => {
			if (e.data?.type === 'otto-open-url' && typeof e.data.url === 'string') {
				openUrl(e.data.url).catch((err: unknown) => {
					console.error('[otto] Failed to open URL:', err);
				});
				if (e.data.url.includes('/oauth/') || e.data.url.includes('/auth/')) {
					startOAuthPolling();
				}
			}
		};
		window.addEventListener('message', handler);
		return () => window.removeEventListener('message', handler);
	}, [startOAuthPolling]);

	if (!serverReady) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center gap-4">
				<SetuLoader
					label={
						serverError
							? serverError
							: serverLoading
								? 'Starting server...'
								: 'Preparing...'
					}
				/>
				{serverError && (
					<button
						type="button"
						onClick={() => {
							startedRef.current = false;
							if (homePath) startServer(homePath);
						}}
						className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
					>
						Retry
					</button>
				)}
			</div>
		);
	}

	return (
		<>
			<div
				className="shrink-0 flex items-center justify-between px-4 h-10 border-b border-border cursor-default select-none fixed top-0 left-0 right-0 z-[10000] bg-background"
				onMouseDown={handleTitleBarDrag}
				data-tauri-drag-region
				role="toolbar"
			>
				<div
				className={`flex items-center gap-2 ${isFullscreen || platform === 'linux' ? '' : 'ml-16'}`}
				>
					<span className="font-semibold text-foreground">otto</span>
				</div>
				<div className="flex items-center gap-2 text-sm text-muted-foreground">
					<span
						className={`w-2 h-2 rounded-full ${currentStep === 'wallet' ? 'bg-green-500' : 'bg-blue-500'}`}
					/>
					{currentStep === 'wallet' ? 'Step 1 of 2' : 'Step 2 of 2'}
				{platform === 'linux' && <WindowControls />}
				</div>
			</div>
			<div className="pt-10">
				<OnboardingModal hideHeader />
			</div>
			<SetuTopupModal />
			<Toaster />
		</>
	);
}
