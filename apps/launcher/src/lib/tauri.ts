import { invoke } from '@tauri-apps/api/core';
import { openUrl as tauriOpenUrl } from '@tauri-apps/plugin-opener';

export interface ContainerInfo {
	name: string;
	status: string;
	running: boolean;
}

export interface ContainerCreateOpts {
	name: string;
	repoUrl: string;
	repoDir: string;
	encryptedKey: string;
	password: string;
	gitName: string;
	gitEmail: string;
	apiPort: number;
	devPorts: number[];
	image: string;
	usePersonalSsh?: boolean;
	sshKeyName?: string;
	sshPassphrase?: string;
}

export interface TeamState {
	id: string;
	name: string;
	publicKey: string;
	encryptedKey: string;
	gitName: string;
	gitEmail: string;
}

export interface ProjectState {
	id: string;
	repo: string;
	containerName: string;
	apiPort: number;
	webPort: number;
	status: string;
	image?: string;
	devPorts?: string;
	gitName?: string;
	gitEmail?: string;
	sshMode?: 'team' | 'personal';
	sshKeyName?: string;
	sshPassphrase?: string;
	teamId?: string;
}

export interface LauncherState {
	teams: TeamState[];
	projects: ProjectState[];
}

export interface OttoTeamConfig {
	version: number;
	repo: string;
	key: string;
	cipher: string;
	gitName: string;
	gitEmail: string;
	image: string;
	devPorts: string;
}

export interface KeyPair {
	publicKey: string;
	encryptedPrivateKey: string;
}

export interface SshKeyInfo {
	name: string;
	path: string;
	keyType: string;
	publicKey: string;
	hasPassphrase: boolean;
}

export const tauri = {
	dockerAvailable: () => invoke<boolean>('docker_available'),
	imageExists: (image: string) => invoke<boolean>('image_exists', { image }),
	imagePull: (image: string) => invoke<string>('image_pull', { image }),
	containerExists: (name: string) =>
		invoke<boolean>('container_exists', { name }),
	containerRunning: (name: string) =>
		invoke<boolean>('container_running', { name }),
	containerInspect: (name: string) =>
		invoke<ContainerInfo>('container_inspect', { name }),
	containerCreate: (opts: ContainerCreateOpts) =>
		invoke<string>('container_create', { opts }),
	containerStart: (name: string) => invoke<void>('container_start', { name }),
	containerStop: (name: string) => invoke<void>('container_stop', { name }),
	containerRemove: (name: string) => invoke<void>('container_remove', { name }),
	containerLogs: (name: string, lines: number) =>
		invoke<string>('container_logs', { name, lines }),
	containerExec: (name: string, cmd: string) =>
		invoke<string>('container_exec', { name, cmd }),
	containerRestartOtto: (name: string, repoDir: string, apiPort: number) =>
		invoke<void>('container_restart_otto', { name, repoDir, apiPort }),
	containerUpdateOtto: (name: string) =>
		invoke<string>('container_update_otto', { name }),

	generateDeployKey: () => invoke<KeyPair>('generate_deploy_key'),
	encryptKey: (privateKey: string, password: string) =>
		invoke<string>('encrypt_key', { privateKey, password }),
	decryptKey: (encrypted: string, password: string) =>
		invoke<string>('decrypt_key', { encrypted, password }),
	verifyPassword: (encrypted: string, password: string) =>
		invoke<boolean>('verify_password', { encrypted, password }),
	publicKeyFromEncrypted: (encrypted: string, password: string) =>
		invoke<string>('public_key_from_encrypted', { encrypted, password }),
	listSshKeys: () => invoke<SshKeyInfo[]>('list_ssh_keys'),
	getHostGitConfig: () => invoke<[string, string]>('get_host_git_config'),

	loadState: () => invoke<LauncherState>('load_state'),
	saveState: (state: LauncherState) => invoke<void>('save_state', { state }),
	parseTeamConfig: (content: string) =>
		invoke<OttoTeamConfig>('parse_team_config', { content }),
	exportTeamConfig: (config: OttoTeamConfig) =>
		invoke<string>('export_team_config', { config }),
	saveOttoFile: (config: OttoTeamConfig, defaultName: string) =>
		invoke<boolean>('save_otto_file', { config, defaultName }),

	findAvailablePort: (trackedPorts: number[]) =>
		invoke<number>('find_available_port', { trackedPorts }),
};

export const openUrl = (url: string) => tauriOpenUrl(url);
