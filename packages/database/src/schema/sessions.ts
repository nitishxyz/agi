import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	title: text('title'),
	agent: text('agent').notNull(),
	provider: text('provider').notNull(),
	model: text('model').notNull(),
	projectPath: text('project_path').notNull(),
	createdAt: integer('created_at', { mode: 'number' }).notNull(),
	// Metadata
	lastActiveAt: integer('last_active_at', { mode: 'number' }),
	totalInputTokens: integer('total_input_tokens'),
	totalOutputTokens: integer('total_output_tokens'),
	totalToolTimeMs: integer('total_tool_time_ms'),
	toolCountsJson: text('tool_counts_json'), // JSON object of name->count
});
