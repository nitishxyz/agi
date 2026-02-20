import {
	listFiles as apiListFiles,
	getFileTree as apiGetFileTree,
	readFile as apiReadFile,
	getSessionFiles as apiGetSessionFiles,
} from '@ottocode/api';
import type { SessionFilesResponse } from '../../types/api';
import { extractErrorMessage } from './utils';

export const filesMixin = {
	async listFiles() {
		const response = await apiListFiles();
		if (response.error) throw new Error(extractErrorMessage(response.error));
		return response.data as {
			files: string[];
			ignoredFiles?: string[];
			changedFiles: Array<{ path: string; status: string }>;
			truncated: boolean;
		};
	},

	async getFileTree(dirPath = '.'): Promise<{
		items: Array<{
			name: string;
			path: string;
			type: 'file' | 'directory';
			gitignored?: boolean;
		}>;
		path: string;
	}> {
		const response = await apiGetFileTree({
			query: { path: dirPath },
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async readFileContent(filePath: string): Promise<{
		content: string;
		path: string;
		extension: string;
		lineCount: number;
	}> {
		const response = await apiReadFile({
			query: { path: filePath },
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async getSessionFiles(sessionId: string): Promise<SessionFilesResponse> {
		const response = await apiGetSessionFiles({ path: { sessionId } });
		if (response.error) throw new Error(extractErrorMessage(response.error));
		return response.data as SessionFilesResponse;
	},
};
