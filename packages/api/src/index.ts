/**
 * @agi-cli/api - Type-safe API client for AGI CLI server
 *
 * This package provides a fully typed API client generated from the OpenAPI spec,
 * plus utilities for SSE streaming and common patterns.
 */

// Re-export generated types and client
export * from './generated/types.js';
export type { ApiClient } from './generated/client.js';

// Export our custom client factory
export { createApiClient } from './client.js';
export type { ApiClientConfig } from './client.js';

// Export SSE utilities
export { createSSEStream, parseSSEEvent } from './streaming.js';
export type { SSEEvent, SSEStreamOptions } from './streaming.js';

// Export helpers
export { isApiError, handleApiError } from './utils.js';
export type { ApiError } from './utils.js';
