import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../lib/config';

interface WindowWithAgiServerUrl extends Window {
	AGI_SERVER_URL?: string;
}

interface WorkingDirectoryInfo {
	cwd: string;
	dirName: string;
}

export function useWorkingDirectory() {
	const [dirName, setDirName] = useState<string | null>(null);

	useEffect(() => {
		const fetchWorkingDirectory = async () => {
			try {
				const win = window as WindowWithAgiServerUrl;
				const baseUrl = win.AGI_SERVER_URL || API_BASE_URL;
				const url = `${baseUrl}/v1/config/cwd`;

				console.log('[useWorkingDirectory] Fetching from:', url);

				const response = await fetch(url);
				if (!response.ok) {
					console.error('[useWorkingDirectory] Failed:', response.status, response.statusText);
					throw new Error(`Failed to fetch working directory: ${response.status}`);
				}

				const data: WorkingDirectoryInfo = await response.json();
				console.log('[useWorkingDirectory] Success:', data);

				if (data.dirName) {
					console.log('[useWorkingDirectory] Setting title to:', data.dirName);
					setDirName(data.dirName);
					document.title = data.dirName;
				}
			} catch (error) {
				console.error('[useWorkingDirectory] Error:', error);
				document.title = 'AGI'; // Fallback title
			}
		};

		fetchWorkingDirectory();
	}, []); // Run once on mount

	return dirName;
}
