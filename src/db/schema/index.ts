import { relations } from 'drizzle-orm';
export { sessions } from './sessions.ts';
export { messages } from './messages.ts';
export { messageParts } from './message-parts.ts';
export { artifacts } from './artifacts.ts';

import { sessions } from './sessions.ts';
import { messages } from './messages.ts';
import { messageParts } from './message-parts.ts';
import { artifacts } from './artifacts.ts';

export const sessionsRelations = relations(sessions, ({ many }) => ({
	messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
	session: one(sessions, {
		fields: [messages.sessionId],
		references: [sessions.id],
	}),
	parts: many(messageParts),
}));

export const messagePartsRelations = relations(messageParts, ({ one }) => ({
	message: one(messages, {
		fields: [messageParts.messageId],
		references: [messages.id],
	}),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
	part: one(messageParts, {
		fields: [artifacts.messagePartId],
		references: [messageParts.id],
	}),
}));
