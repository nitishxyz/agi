import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sessions } from './sessions.ts';

export const messages = sqliteTable('messages', {
	id: text('id').primaryKey(),
	sessionId: text('session_id')
		.notNull()
		.references(() => sessions.id, { onDelete: 'cascade' }),
	role: text('role').notNull(), // 'system' | 'user' | 'assistant' | 'tool'
	status: text('status').notNull(), // 'pending' | 'complete' | 'error'
	agent: text('agent').notNull(),
	provider: text('provider').notNull(),
	model: text('model').notNull(),
	createdAt: integer('created_at', { mode: 'number' }).notNull(),
	// Metadata
	completedAt: integer('completed_at', { mode: 'number' }),
	latencyMs: integer('latency_ms'),
	promptTokens: integer('prompt_tokens'),
	completionTokens: integer('completion_tokens'),
	totalTokens: integer('total_tokens'),
	cachedInputTokens: integer('cached_input_tokens'),
	reasoningTokens: integer('reasoning_tokens'),
	// Error fields
	error: text('error'),
	errorType: text('error_type'), // 'api_error', 'abort', 'validation_error', etc.
	errorDetails: text('error_details'), // JSON string with full error object
	isAborted: integer('is_aborted', { mode: 'boolean' }), // flag for user aborts
});
