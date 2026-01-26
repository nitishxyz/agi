import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const sharedSessions = sqliteTable('shared_sessions', {
	shareId: text('share_id').primaryKey(),
	secret: text('secret').notNull(),
	title: text('title'),
	description: text('description'),
	sessionData: text('session_data').notNull(),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull(),
	expiresAt: integer('expires_at'),
	viewCount: integer('view_count').default(0),
	lastSyncedMessageId: text('last_synced_message_id').notNull(),
});
