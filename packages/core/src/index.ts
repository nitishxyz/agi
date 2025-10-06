// =======================
// Core AI Functions (from AI SDK)
// =======================
export {
	generateText,
	streamText,
	generateObject,
	streamObject,
	tool,
} from 'ai';
export type { CoreMessage, Tool } from 'ai';

// =======================
// Provider & Model Resolution
// =======================
export { resolveModel } from './providers/resolver';
export type { ProviderName, ModelConfig } from './providers/resolver';

// Re-export provider catalog and utilities for easy access
export {
	catalog,
	providerIds,
	isProviderId,
	isProviderAuthorized,
	validateProviderModel,
} from '@agi-cli/providers';
export type { ProviderId, ModelInfo } from '@agi-cli/providers';

// =======================
// Tools
// =======================
export { discoverProjectTools } from './tools/loader';
export type { DiscoveredTool } from './tools/loader';

// Re-export builtin tools for direct access
export { buildFsTools } from './tools/builtin/fs/index';
export { buildGitTools } from './tools/builtin/git';

// =======================
// Streaming & Artifacts
// =======================
export {
	createFileDiffArtifact,
	createToolResultPayload,
} from './streaming/artifacts';
export type {
	Artifact,
	FileDiffArtifact,
	FileArtifact,
} from './streaming/artifacts';

// =======================
// Types
// =======================
export type { ExecutionContext, ToolResult } from './types/index';

// =======================
// Schema Validation
// =======================
export { z } from 'zod';

// =======================
// Error Handling
// =======================
export {
	AGIError,
	AuthError,
	ConfigError,
	ToolError,
	ProviderError,
	DatabaseError,
	ValidationError,
	NotFoundError,
	ServiceError,
} from './errors';
