import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { messageParts } from './message-parts.ts';

export const artifacts = sqliteTable('artifacts', {
	id: text('id').primaryKey(),
	messagePartId: text('message_part_id')
		.unique()
		.references(() => messageParts.id, { onDelete: 'cascade' }),
	kind: text('kind').notNull(), // 'file' | 'file_diff' | ...
	path: text('path'),
	mime: text('mime'),
	size: integer('size'),
	sha256: text('sha256'),
});
