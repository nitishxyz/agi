import { invoke } from '@tauri-apps/api/core';

export interface Project {
	path: string;
	name: string;
	lastOpened: string;
	pinned: boolean;
}

export interface ServerInfo {
	pid: number;
	port: number;
	webPort: number;
	url: string;
	projectPath: string;
}

export interface GitHubRepo {
	id: number;
	name: string;
	fullName: string;
	cloneUrl: string;
	private: boolean;
	description: string | null;
}

export interface GitHubUser {
	login: string;
	name: string | null;
	avatarUrl: string;
}

export interface GitStatus {
	branch: string;
	ahead: number;
	behind: number;
	changedFiles: Array<{ path: string; status: string }>;
	hasChanges: boolean;
}

export const isDesktopApp = (): boolean => {
	try {
		return '__TAURI__' in window;
	} catch {
		return false;
	}
};

export const tauriBridge = {
	openProjectDialog: () => invoke<string | null>('open_project_dialog'),
	getRecentProjects: () => invoke<Project[]>('get_recent_projects'),
	saveRecentProject: (project: Project) =>
		invoke('save_recent_project', { project }),
	removeRecentProject: (path: string) =>
		invoke('remove_recent_project', { path }),
	toggleProjectPinned: (path: string) =>
		invoke('toggle_project_pinned', { path }),

	startServer: (projectPath: string, port?: number) =>
		invoke<ServerInfo>('start_server', { projectPath, port }),
	stopServer: (pid: number) => invoke('stop_server', { pid }),
	stopAllServers: () => invoke('stop_all_servers'),
	listServers: () => invoke<ServerInfo[]>('list_servers'),

	createNewWindow: () => invoke('create_new_window'),

	getInitialProject: () => invoke<string | null>('get_initial_project'),

	githubSaveToken: (token: string) => invoke('github_save_token', { token }),
	githubGetToken: () => invoke<string | null>('github_get_token'),
	githubLogout: () => invoke('github_logout'),
	githubGetUser: (token: string) =>
		invoke<GitHubUser>('github_get_user', { token }),
	githubListRepos: (token: string) =>
		invoke<GitHubRepo[]>('github_list_repos', { token }),

	gitClone: (url: string, path: string, token: string) =>
		invoke('git_clone', { url, path, token }),
	gitStatus: (path: string) => invoke<GitStatus>('git_status', { path }),
	gitCommit: (path: string, message: string) =>
		invoke<string>('git_commit', { path, message }),
	gitPush: (path: string, token: string) => invoke('git_push', { path, token }),
	gitPull: (path: string, token: string) => invoke('git_pull', { path, token }),
	gitIsRepo: (path: string) => invoke<boolean>('git_is_repo', { path }),
};
