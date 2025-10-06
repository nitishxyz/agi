// ============================================================================
// @agi-cli/sdk - Tree-shakable AI Agent SDK
// ============================================================================
// This is the SINGLE source of truth for all AGI CLI functionality.
// All exports are tree-shakable - bundlers will only include what you use.
//
// Usage:
//   import { generateText, resolveModel } from '@agi-cli/sdk';
//   import type { ProviderId, AGIConfig } from '@agi-cli/sdk';
//
// Note: Direct package imports are still available but discouraged:
//   import { catalog } from '@agi-cli/providers'; // ❌ Discouraged
//   import { catalog } from '@agi-cli/sdk';       // ✅ Recommended
// ============================================================================

// =======================
// Types (from @agi-cli/types)
// =======================
// Provider types
export type { ProviderId, ModelInfo } from '@agi-cli/types';

// Auth types
export type { ApiAuth, OAuth, AuthInfo, AuthFile } from '@agi-cli/types';

// Config types
export type {
	Scope,
	ProviderConfig,
	DefaultConfig,
	PathConfig,
	AGIConfig,
} from '@agi-cli/types';

// =======================
// Providers (from @agi-cli/providers)
// =======================
export { catalog } from '@agi-cli/providers';
export {
	isProviderId,
	providerIds,
	defaultModelFor,
	hasModel,
} from '@agi-cli/providers';
export {
	isProviderAuthorized,
	ensureProviderEnv,
} from '@agi-cli/providers';
export { validateProviderModel } from '@agi-cli/providers';
export { estimateModelCostUsd } from '@agi-cli/providers';
export { providerEnvVar, readEnvKey, setEnvKey } from '@agi-cli/providers';

// =======================
// Authentication (from @agi-cli/auth)
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

// =======================
// Configuration (from @agi-cli/config)
// =======================
export { loadConfig, read as readConfig } from '@agi-cli/config';

// =======================
// Prompts (from @agi-cli/prompts)
// =======================
export { providerBasePrompt } from '@agi-cli/prompts';

// =======================
// Database (from @agi-cli/database)
// =======================
export { getDb } from '@agi-cli/database';
export * as dbSchema from '@agi-cli/database/schema';

// =======================
// Core AI Functions (from @agi-cli/core)
// =======================
// AI SDK re-exports
export {
	generateText,
	streamText,
	generateObject,
	streamObject,
	tool,
} from '@agi-cli/core';
export type { CoreMessage, Tool } from '@agi-cli/core';

// Provider & Model Resolution
export { resolveModel } from '@agi-cli/core';
export type { ProviderName, ModelConfig } from '@agi-cli/core';

// Tools
export { discoverProjectTools } from '@agi-cli/core';
export type { DiscoveredTool } from '@agi-cli/core';
export { buildFsTools } from '@agi-cli/core';
export { buildGitTools } from '@agi-cli/core';

// Streaming & Artifacts
export {
	createFileDiffArtifact,
	createToolResultPayload,
} from '@agi-cli/core';
export type {
	Artifact,
	FileDiffArtifact,
	FileArtifact,
} from '@agi-cli/core';

// Core Types
export type { ExecutionContext, ToolResult } from '@agi-cli/core';

// Error Handling
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
} from '@agi-cli/core';

// Schema Validation
export { z } from '@agi-cli/core';

// =======================
// Server (from @agi-cli/server)
// =======================
export { createApp as createServer } from '@agi-cli/server';

// =======================
// SDK-specific Agent Types
// =======================
export type { AgentConfig, AgentConfigEntry } from './agent/types.ts';
