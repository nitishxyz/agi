import { invoke } from '@tauri-apps/api/core';

export async function workspaceFileExists(projectPath: string) {
	return invoke<boolean>('workspace_file_exists', { projectPath });
}

export async function readWorkspaceFile(projectPath: string) {
	return invoke<string>('workspace_file_read', { projectPath });
}

export async function writeWorkspaceFile(projectPath: string, content: string) {
	return invoke<void>('workspace_file_write', { projectPath, content });
}
