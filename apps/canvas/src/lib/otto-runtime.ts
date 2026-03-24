import { invoke } from '@tauri-apps/api/core';

export interface WorkspaceRuntimeInfo {
	workspaceId: string;
	environmentId: string;
	projectPath: string;
	pid: number;
	port: number;
	url: string;
	logPath: string;
}

export async function startWorkspaceRuntime(input: {
	workspaceId: string;
	environmentId: string;
	projectPath: string;
}) {
	return invoke<WorkspaceRuntimeInfo>('workspace_start_runtime', input);
}

export async function getWorkspaceRuntime(workspaceId: string) {
	return invoke<WorkspaceRuntimeInfo | null>('workspace_get_runtime', {
		workspaceId,
	});
}

export async function stopWorkspaceRuntime(workspaceId: string) {
	return invoke('workspace_stop_runtime', { workspaceId });
}

export async function readWorkspaceRuntimeLog(logPath: string) {
	return invoke<string>('workspace_read_runtime_log', { logPath });
}

export async function listWorkspaceRuntimes() {
	return invoke<WorkspaceRuntimeInfo[]>('workspace_list_runtimes');
}

export async function stopAllWorkspaceRuntimes() {
	return invoke('workspace_stop_all_runtimes');
}

export async function waitForWorkspaceRuntime(
	url: string,
	options?: { attempts?: number; delayMs?: number },
) {
	const attempts = options?.attempts ?? 60;
	const delayMs = options?.delayMs ?? 250;

	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			const response = await fetch(`${url}/openapi.json`, {
				method: 'GET',
				headers: { Accept: 'application/json' },
			});
			if (response.ok) return;
		} catch {
			// Ignore transient startup errors.
		}
		await new Promise((resolve) => window.setTimeout(resolve, delayMs));
	}

	throw new Error('Timed out waiting for otto workspace runtime to become ready.');
}
