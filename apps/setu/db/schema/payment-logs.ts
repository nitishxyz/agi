import {
	pgTable,
	text,
	numeric,
	timestamp,
	uuid,
	boolean,
	uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const paymentLogs = pgTable(
	'router_payment_logs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		walletAddress: text('wallet_address')
			.notNull()
			.references(() => users.walletAddress),
		txSignature: text('tx_signature').unique(),
		polarCheckoutId: text('polar_checkout_id'),
		paymentMethod: text('payment_method', {
			enum: ['crypto', 'fiat'],
		})
			.notNull()
			.default('crypto'),
		amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
		status: text('status').notNull(),
		verified: boolean('verified').default(false),
		createdAt: timestamp('created_at').notNull().defaultNow(),
	},
	(table) => ({
		polarCheckoutIdx: uniqueIndex('polar_checkout_idx')
			.on(table.polarCheckoutId)
			.where(sql`${table.polarCheckoutId} IS NOT NULL`),
	}),
);
