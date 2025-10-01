// =======================
// Core AI Functions
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
export { resolveModel } from './providers/resolver.ts';
export type { ProviderName, ModelConfig } from './providers/resolver.ts';

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
export { discoverProjectTools } from './tools/loader.ts';
export type { DiscoveredTool } from './tools/loader.ts';

// Re-export for testing/advanced usage
export { buildFsTools } from './tools/builtin/fs/index.ts';
export { buildGitTools } from './tools/builtin/git.ts';

// =======================
// Streaming & Artifacts
// =======================
export {
	createFileDiffArtifact,
	createToolResultPayload,
} from './streaming/artifacts.ts';
export type {
	Artifact,
	FileDiffArtifact,
	FileArtifact,
} from './streaming/artifacts.ts';

// =======================
// Server
// =======================
export { createApp as createServer } from '@agi-cli/server';

// =======================
// Configuration
// =======================
export { loadConfig, read as readConfig } from '@agi-cli/config';
export type { AGIConfig, ProviderConfig, Scope } from '@agi-cli/config';

// =======================
// Authentication
// =======================
export {
	getAllAuth,
	getAuth,
	setAuth,
	removeAuth,
	authorize,
	exchange,
	refreshToken,
	openAuthUrl,
	createApiKey,
} from '@agi-cli/auth';
export type { AuthInfo, OAuth } from '@agi-cli/auth';

// =======================
// Database
// =======================
export { getDb } from '@agi-cli/database';
export * as dbSchema from '@agi-cli/database/schema';

// =======================
// Types
// =======================
export type { ExecutionContext, ToolResult } from './types/index.ts';
export type { AgentConfig, AgentConfigEntry } from './agent/types.ts';

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
} from './errors.ts';
