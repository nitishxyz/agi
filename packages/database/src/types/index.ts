import type { InferSelectModel } from 'drizzle-orm';
import type { sessions } from '../schema/sessions.ts';
import type { messages } from '../schema/messages.ts';
import type { messageParts } from '../schema/message-parts.ts';

export type Session = InferSelectModel<typeof sessions>;
export type Message = InferSelectModel<typeof messages>;
export type MessagePart = InferSelectModel<typeof messageParts>;
