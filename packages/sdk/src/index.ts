// =======================
// Re-export everything from @agi-cli/core
// =======================
export * from '@agi-cli/core';

// =======================
// Server (batteries included)
// =======================
export { createApp as createServer } from '@agi-cli/server';

// =======================
// Database (convenience re-export)
// =======================
export { getDb } from '@agi-cli/database';
export * as dbSchema from '@agi-cli/database/schema';

// =======================
// Configuration (convenience re-export)
// =======================
export { loadConfig, read as readConfig } from '@agi-cli/config';
export type { AGIConfig, ProviderConfig, Scope } from '@agi-cli/config';

// =======================
// Authentication (convenience re-export)
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
// Agent Types (from SDK-specific modules)
// =======================
export type { AgentConfig, AgentConfigEntry } from './agent/types.ts';
