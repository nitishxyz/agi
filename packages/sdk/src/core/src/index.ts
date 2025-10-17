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
} from '../../providers/src/index.ts';
export type { ProviderId, ModelInfo } from '../../types/src/index.ts';

// =======================
// Tools
// =======================
export { discoverProjectTools } from './tools/loader';
export type { DiscoveredTool } from './tools/loader';
export { setTerminalManager, getTerminalManager } from './tools/loader';

// Tool error handling utilities
export {
	isToolError,
	extractToolError,
	createToolError,
} from './tools/error';
export type {
	ToolErrorType,
	ToolErrorResponse,
	ToolSuccessResponse,
	ToolResponse,
} from './tools/error';

// Re-export builtin tools for direct access
export { buildFsTools } from './tools/builtin/fs/index';
export { buildGitTools } from './tools/builtin/git';
export { buildTerminalTool } from './tools/builtin/terminal';

// =======================
// Terminals
// =======================
export { TerminalManager } from './terminals/index';
export type {
	Terminal,
	TerminalOptions,
	TerminalStatus,
	TerminalCreator,
	CreateTerminalOptions,
} from './terminals/index';

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
