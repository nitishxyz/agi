import {
	pgTable,
	text,
	numeric,
	integer,
	timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('router_users', {
	walletAddress: text('wallet_address').primaryKey(),
	balanceUsd: numeric('balance_usd', { precision: 12, scale: 8 })
		.notNull()
		.default('0.00000000'),
	totalSpent: numeric('total_spent', { precision: 12, scale: 8 })
		.notNull()
		.default('0.00000000'),
	totalTopups: numeric('total_topups', { precision: 10, scale: 2 })
		.notNull()
		.default('0.00'),
	requestCount: integer('request_count').notNull().default(0),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	lastRequest: timestamp('last_request'),
});
