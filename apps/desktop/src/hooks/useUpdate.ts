import { useState, useEffect, useCallback } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { listen } from '@tauri-apps/api/event';

interface UpdateInfo {
	version: string;
	currentVersion: string;
}

type DownloadEvent =
	| { event: 'started'; data: { contentLength: number | null } }
	| { event: 'progress'; data: { chunkLength: number; downloaded: number } }
	| { event: 'finished' };

interface UpdateState {
	available: boolean;
	version: string | null;
	downloading: boolean;
	downloaded: boolean;
	progress: number;
	totalBytes: number;
	error: string | null;
}

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

export function useUpdate() {
	const [state, setState] = useState<UpdateState>({
		available: false,
		version: null,
		downloading: false,
		downloaded: false,
		progress: 0,
		totalBytes: 0,
		error: null,
	});

	const checkForUpdate = useCallback(async () => {
		try {
			console.log('[otto] Checking for updates...');
			const result = await invoke<UpdateInfo | null>('check_for_update');
			console.log('[otto] Update check result:', result);
			if (result) {
				setState((s) => ({
					...s,
					available: true,
					version: result.version,
					error: null,
				}));
			}
		} catch (e) {
			console.error('[otto] Update check failed:', e);
			setState((s) => ({ ...s, error: String(e) }));
		}
	}, []);

	useEffect(() => {
		checkForUpdate();
		const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
		return () => {
			clearInterval(interval);
		};
	}, [checkForUpdate]);

	useEffect(() => {
		const unlisten = listen('menu-check-for-updates', () => {
			checkForUpdate();
		});
		return () => {
			unlisten.then((fn) => fn());
		};
	}, [checkForUpdate]);

	const downloadUpdate = useCallback(async () => {
		try {
			setState((s) => ({ ...s, downloading: true, progress: 0, error: null }));

			const onEvent = new Channel<DownloadEvent>();
			onEvent.onmessage = (event) => {
				if (event.event === 'started' && event.data.contentLength) {
					setState((s) => ({
						...s,
						totalBytes: event.data.contentLength ?? 0,
					}));
				} else if (event.event === 'progress') {
					setState((s) => {
						const pct =
							s.totalBytes > 0
								? Math.round((event.data.downloaded / s.totalBytes) * 100)
								: 0;
						return { ...s, progress: pct };
					});
				} else if (event.event === 'finished') {
					setState((s) => ({
						...s,
						downloading: false,
						downloaded: true,
						progress: 100,
					}));
				}
			};

			await invoke('download_update', { onEvent });
			setState((s) => ({
				...s,
				downloading: false,
				downloaded: true,
				progress: 100,
			}));
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			setState((s) => ({ ...s, downloading: false, error: msg }));
		}
	}, []);

	const applyUpdate = useCallback(async () => {
		try {
			await invoke('apply_update');
			await relaunch();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			setState((s) => ({ ...s, error: msg }));
		}
	}, []);

	return { ...state, downloadUpdate, applyUpdate, checkForUpdate };
}
