import type { getDb } from '@agi-cli/database';
import { messages, messageParts } from '@agi-cli/database/schema';
import { eq, asc } from 'drizzle-orm';

export async function buildCompactionContext(
	db: Awaited<ReturnType<typeof getDb>>,
	sessionId: string,
	contextTokenLimit?: number,
): Promise<string> {
	const allMessages = await db
		.select()
		.from(messages)
		.where(eq(messages.sessionId, sessionId))
		.orderBy(asc(messages.createdAt));

	const lines: string[] = [];
	let totalChars = 0;
	const maxChars = contextTokenLimit ? contextTokenLimit * 4 : 60000;

	for (const msg of allMessages) {
		if (totalChars > maxChars) {
			lines.unshift('[...earlier content truncated...]');
			break;
		}

		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, msg.id))
			.orderBy(asc(messageParts.index));

		for (const part of parts) {
			if (part.compactedAt) continue;

			try {
				const content = JSON.parse(part.content ?? '{}');

				if (part.type === 'text' && content.text) {
					const text = `[${msg.role.toUpperCase()}]: ${content.text}`;
					lines.push(text.slice(0, 3000));
					totalChars += text.length;
				} else if (part.type === 'tool_call' && content.name) {
					const argsStr =
						typeof content.args === 'object'
							? JSON.stringify(content.args).slice(0, 500)
							: '';
					const text = `[TOOL ${content.name}]: ${argsStr}`;
					lines.push(text);
					totalChars += text.length;
				} else if (part.type === 'tool_result' && content.result !== null) {
					const resultStr =
						typeof content.result === 'string'
							? content.result.slice(0, 1500)
							: JSON.stringify(content.result ?? '').slice(0, 1500);
					const text = `[RESULT]: ${resultStr}`;
					lines.push(text);
					totalChars += text.length;
				}
			} catch {}
		}
	}

	return lines.join('\n');
}
