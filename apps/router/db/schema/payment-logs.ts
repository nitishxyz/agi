import {
	pgTable,
	text,
	numeric,
	timestamp,
	uuid,
	boolean,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const paymentLogs = pgTable('router_payment_logs', {
	id: uuid('id').primaryKey().defaultRandom(),
	walletAddress: text('wallet_address')
		.notNull()
		.references(() => users.walletAddress),
	txSignature: text('tx_signature').unique().notNull(),
	amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
	status: text('status').notNull(),
	verified: boolean('verified').default(false),
	createdAt: timestamp('created_at').notNull().defaultNow(),
});
