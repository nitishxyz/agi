export type {
	MCPServerConfig,
	MCPConfig,
	MCPServerStatus,
} from './types.ts';

export { MCPClientWrapper, type MCPToolInfo } from './client.ts';

export { MCPServerManager } from './server-manager.ts';

export { convertMCPToolsToAISDK } from './tools.ts';

export {
	getMCPManager,
	initializeMCP,
	shutdownMCP,
	loadMCPConfig,
	addMCPServerToConfig,
	removeMCPServerFromConfig,
} from './lifecycle.ts';
