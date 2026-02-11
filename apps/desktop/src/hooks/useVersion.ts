import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';

export function useVersion(): string | null {
	const [version, setVersion] = useState<string | null>(null);

	useEffect(() => {
		getVersion().then(setVersion).catch(() => {});
	}, []);

	return version;
}
