import { pgTable, text, numeric, integer, timestamp, uuid, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const transactions = pgTable('router_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull().references(() => users.walletAddress),
  type: text('type', { enum: ['topup', 'deduction'] }).notNull(),
  amountUsd: numeric('amount_usd', { precision: 12, scale: 8 }).notNull(),
  txSignature: text('tx_signature'),
  provider: text('provider'),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  balanceBefore: numeric('balance_before', { precision: 12, scale: 8 }).notNull(),
  balanceAfter: numeric('balance_after', { precision: 12, scale: 8 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  walletIdx: index('router_tx_wallet_idx').on(table.walletAddress),
  typeIdx: index('router_tx_type_idx').on(table.type),
  createdAtIdx: index('router_tx_created_at_idx').on(table.createdAt),
}));
