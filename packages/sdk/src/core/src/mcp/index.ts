export type {
	MCPServerConfig,
	MCPConfig,
	MCPServerStatus,
	MCPTransport,
	MCPOAuthConfig,
	MCPScope,
} from './types.ts';

export { MCPClientWrapper, type MCPToolInfo } from './client.ts';

export { MCPServerManager } from './server-manager.ts';

export { convertMCPToolsToAISDK } from './tools.ts';

export {
	getMCPToolBriefs,
	buildLoadMCPToolsTool,
	getMCPToolsRecord,
	buildMCPToolCatalogDescription,
	type MCPToolBrief,
} from './lazy-tools.ts';

export {
	getMCPManager,
	initializeMCP,
	shutdownMCP,
	loadMCPConfig,
	addMCPServerToConfig,
	removeMCPServerFromConfig,
} from './lifecycle.ts';

export {
	OAuthCredentialStore,
	OttoOAuthProvider,
	OAuthCallbackServer,
	type StoredOAuthData,
	type OttoOAuthProviderOptions,
	type CallbackResult,
} from './oauth/index.ts';
