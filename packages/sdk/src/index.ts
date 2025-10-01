export { resolveModel } from './providers/resolver.ts';
export type { ProviderName, ModelConfig } from './providers/resolver.ts';

export { discoverProjectTools } from './tools/loader.ts';
export type { DiscoveredTool } from './tools/loader.ts';

export {
	createFileDiffArtifact,
	createToolResultPayload,
} from './streaming/artifacts.ts';
export type {
	Artifact,
	FileDiffArtifact,
	FileArtifact,
} from './streaming/artifacts.ts';

export type { ExecutionContext, ToolResult } from './types/index.ts';

export type { AgentConfig, AgentConfigEntry } from './agent/types.ts';
