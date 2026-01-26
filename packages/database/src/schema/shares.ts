import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const shares = sqliteTable('shares', {
	sessionId: text('session_id').primaryKey(),
	shareId: text('share_id').notNull().unique(),
	secret: text('secret').notNull(),
	url: text('url').notNull(),
	title: text('title'),
	description: text('description'),
	createdAt: integer('created_at', { mode: 'number' }).notNull(),
	lastSyncedAt: integer('last_synced_at', { mode: 'number' }).notNull(),
	lastSyncedMessageId: text('last_synced_message_id').notNull(),
});
