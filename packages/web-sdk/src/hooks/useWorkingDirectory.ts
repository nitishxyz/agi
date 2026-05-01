import { useEffect, useState } from 'react';
import { getCwd } from '@ottocode/api';
import { getBaseUrl } from '../lib/api-client/utils';

interface WorkingDirectoryInfo {
	cwd: string;
	dirName: string;
}

export function useWorkingDirectory() {
	const [dirName, setDirName] = useState<string | null>(null);

	useEffect(() => {
		const fetchWorkingDirectory = async () => {
			try {
				const response = await getCwd({ baseURL: getBaseUrl() });
				if (response.error) {
					throw new Error(JSON.stringify(response.error));
				}

				const data = response.data as WorkingDirectoryInfo;
				console.log('[useWorkingDirectory] Success:', data);

				if (data.dirName) {
					console.log('[useWorkingDirectory] Setting title to:', data.dirName);
					setDirName(data.dirName);
					document.title = data.dirName;
				}
			} catch (error) {
				console.error('[useWorkingDirectory] Error:', error);
				document.title = 'otto'; // Fallback title
			}
		};

		fetchWorkingDirectory();
	}, []); // Run once on mount

	return dirName;
}
