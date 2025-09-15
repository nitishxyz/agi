import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { messages } from './messages.ts';

export const messageParts = sqliteTable('message_parts', {
	id: text('id').primaryKey(),
	messageId: text('message_id')
		.notNull()
		.references(() => messages.id, { onDelete: 'cascade' }),
	index: integer('index').notNull(),
	type: text('type').notNull(), // 'text' | 'tool_call' | 'tool_result' | 'image' | 'error'
	content: text('content').notNull(), // JSON string
	agent: text('agent').notNull(),
	provider: text('provider').notNull(),
	model: text('model').notNull(),
});
