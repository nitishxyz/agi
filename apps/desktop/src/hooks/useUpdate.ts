import { useState, useEffect, useCallback } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdateState {
	available: boolean;
	version: string | null;
	downloading: boolean;
	installing: boolean;
	progress: number;
	error: string | null;
}

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000;

export function useUpdate() {
	const [state, setState] = useState<UpdateState>({
		available: false,
		version: null,
		downloading: false,
		installing: false,
		progress: 0,
		error: null,
	});
	const [update, setUpdate] = useState<Update | null>(null);

	const checkForUpdate = useCallback(async () => {
		try {
			const result = await check();
			if (result) {
				setUpdate(result);
				setState((s) => ({
					...s,
					available: true,
					version: result.version,
					error: null,
				}));
			}
		} catch (e) {
			console.error('[otto] Update check failed:', e);
		}
	}, []);

	useEffect(() => {
		checkForUpdate();
		const interval = setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
		return () => clearInterval(interval);
	}, [checkForUpdate]);

	const installUpdate = useCallback(async () => {
		if (!update) return;
		try {
			setState((s) => ({ ...s, downloading: true, error: null }));
			let totalBytes = 0;
			let downloadedBytes = 0;
			await update.downloadAndInstall((event) => {
				if (event.event === 'Started' && event.data.contentLength) {
					totalBytes = event.data.contentLength;
				} else if (event.event === 'Progress') {
					downloadedBytes += event.data.chunkLength;
					if (totalBytes > 0) {
						setState((s) => ({
							...s,
							progress: Math.round((downloadedBytes / totalBytes) * 100),
						}));
					}
				} else if (event.event === 'Finished') {
					setState((s) => ({ ...s, downloading: false, installing: true }));
				}
			});
			await relaunch();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			setState((s) => ({
				...s,
				downloading: false,
				installing: false,
				error: msg,
			}));
		}
	}, [update]);

	return { ...state, installUpdate, checkForUpdate };
}
