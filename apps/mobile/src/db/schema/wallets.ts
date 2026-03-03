import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const wallets = sqliteTable('wallets', {
	id: text('id').primaryKey(),

	// The wallet address the user controls (from Grid authentication)
	address: text('address').notNull().unique(),

	// Grid-specific identifiers
	gridUserId: text('grid_user_id'),

	// Display name for the wallet
	name: text('name'),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export type Wallet = typeof wallets.$inferSelect;
export type NewWallet = typeof wallets.$inferInsert;
