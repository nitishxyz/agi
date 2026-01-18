// ============================================================================
// @agi-cli/sdk - Tree-shakable AI Agent SDK
// ============================================================================
// This is the SINGLE source of truth for all AGI CLI functionality.
// All exports are tree-shakable - bundlers will only include what you use.
//
// Usage:
//   import { generateText, resolveModel } from '@agi-cli/sdk';
//   import type { ProviderId, AGIConfig } from '@agi-cli/sdk';
// ============================================================================

// =======================
// Types (from internal types module)
// =======================
// Provider types
export type {
	ProviderId,
	ModelInfo,
	ModelProviderBinding,
	ProviderCatalogEntry,
} from './types/src/index.ts';

// Auth types
export type { ApiAuth, OAuth, AuthInfo, AuthFile } from './types/src/index.ts';

// Config types
export type {
	ProviderConfig,
	DefaultConfig,
	PathConfig,
	AGIConfig,
} from './types/src/index.ts';

// =======================
// Providers (from internal providers module)
// =======================
export { catalog } from './providers/src/index.ts';
export {
	isProviderId,
	providerIds,
	defaultModelFor,
	hasModel,
} from './providers/src/index.ts';
export {
	isProviderAuthorized,
	ensureProviderEnv,
} from './providers/src/index.ts';
export { validateProviderModel } from './providers/src/index.ts';
export { estimateModelCostUsd } from './providers/src/index.ts';
export {
	providerEnvVar,
	readEnvKey,
	setEnvKey,
} from './providers/src/index.ts';
export {
	createSolforgeFetch,
	createSolforgeModel,
} from './providers/src/index.ts';
export type {
	SolforgeAuth,
	SolforgeProviderOptions,
} from './providers/src/index.ts';
export {
	createOpenAIOAuthFetch,
	createOpenAIOAuthModel,
} from './providers/src/index.ts';
export type { OpenAIOAuthConfig } from './providers/src/index.ts';

// =======================
// Authentication (from internal auth module)
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
} from './auth/src/index.ts';
export {
	authorizeOpenAI,
	exchangeOpenAI,
	refreshOpenAIToken,
	openOpenAIAuthUrl,
	obtainOpenAIApiKey,
} from './auth/src/index.ts';
export type { OpenAIOAuthResult } from './auth/src/index.ts';

// =======================
// Configuration (from internal config module)
// =======================
export { loadConfig, read as readConfig } from './config/src/index.ts';
export {
	getLocalDataDir,
	getGlobalConfigDir,
	getGlobalConfigPath,
	getGlobalAgentsJsonPath,
	getGlobalAgentsDir,
	getGlobalToolsDir,
	getGlobalCommandsDir,
	getSecureAuthPath,
	getHomeDir,
} from './config/src/paths.ts';
export {
	read,
	isAuthorized,
	ensureEnv,
	writeDefaults as setConfig,
	writeAuth,
	removeAuth as removeConfig,
} from './config/src/manager.ts';
export type { Scope } from './config/src/manager.ts';

// =======================
// Prompts (from internal prompts module)
// =======================
export { providerBasePrompt } from './prompts/src/providers.ts';

// =======================
// Core AI Functions (from internal core module)
// =======================
// AI SDK re-exports
export {
	generateText,
	streamText,
	generateObject,
	streamObject,
	tool,
} from './core/src/index.ts';
export type { CoreMessage, Tool } from './core/src/index.ts';
// Re-export from AI SDK
export type { ToolCallPart } from 'ai';

// Provider & Model Resolution
export { resolveModel } from './core/src/index.ts';
export type { ProviderName, ModelConfig } from './core/src/index.ts';

// Tools
export { discoverProjectTools } from './core/src/index.ts';
export type { DiscoveredTool } from './core/src/index.ts';
export { setTerminalManager, getTerminalManager } from './core/src/index.ts';
export { buildFsTools } from './core/src/index.ts';
export { buildGitTools } from './core/src/index.ts';

// Terminals
export { TerminalManager } from './core/src/index.ts';
export type {
	Terminal,
	TerminalOptions,
	TerminalStatus,
	TerminalCreator,
	CreateTerminalOptions,
} from './core/src/index.ts';

// Streaming & Artifacts
export {
	createFileDiffArtifact,
	createToolResultPayload,
} from './core/src/index.ts';
export type {
	Artifact,
	FileDiffArtifact,
	FileArtifact,
} from './core/src/index.ts';

// Core Types
export type { ExecutionContext, ToolResult } from './core/src/index.ts';

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
} from './core/src/index.ts';

// Logging & Debug
export {
	logger,
	debug,
	info,
	warn,
	error,
	time,
	isDebugEnabled,
	isTraceEnabled,
} from './core/src/index.ts';

// Schema Validation
export { z } from './core/src/index.ts';

// =======================
// SDK-specific Agent Types
// =======================
export type { AgentConfig, AgentConfigEntry } from './agent/types.ts';
