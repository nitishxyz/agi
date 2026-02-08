import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type Platform = 'macos' | 'linux' | 'windows' | 'unknown';

let cachedPlatform: Platform | null = null;

export function usePlatform(): Platform {
	const [platform, setPlatform] = useState<Platform>(cachedPlatform ?? 'unknown');

	useEffect(() => {
		if (cachedPlatform) return;
		invoke<string>('get_platform').then((os) => {
			const p: Platform =
				os === 'macos' ? 'macos' : os === 'linux' ? 'linux' : os === 'windows' ? 'windows' : 'unknown';
			cachedPlatform = p;
			setPlatform(p);
		});
	}, []);

	return platform;
}
