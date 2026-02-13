export interface MCPServerConfig {
	name: string;
	command: string;
	args?: string[];
	env?: Record<string, string>;
	cwd?: string;
	disabled?: boolean;
}

export interface MCPConfig {
	servers: MCPServerConfig[];
}

export interface MCPServerStatus {
	name: string;
	connected: boolean;
	tools: string[];
	error?: string;
}
