import type { InferSelectModel } from 'drizzle-orm';
import { sessions } from '@/db/schema/sessions.ts';
import { messages } from '@/db/schema/messages.ts';
import { messageParts } from '@/db/schema/message-parts.ts';

export type Session = InferSelectModel<typeof sessions>;
export type Message = InferSelectModel<typeof messages>;
export type MessagePart = InferSelectModel<typeof messageParts>;
