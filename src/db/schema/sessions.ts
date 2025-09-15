import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	title: text('title'),
	agent: text('agent').notNull(),
	provider: text('provider').notNull(),
	model: text('model').notNull(),
	projectPath: text('project_path').notNull(),
	createdAt: integer('created_at', { mode: 'number' }).notNull(),
});
