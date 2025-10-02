import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import type { AGIConfig } from '@agi-cli/config';
import type { DB } from '@agi-cli/database';
import { messages, messageParts, sessions } from '@agi-cli/database/schema';
import { publish } from '../events/bus.ts';
import { enqueueAssistantRun } from './runner.ts';
import { resolveModel } from './provider.ts';
import type { ProviderId } from '@agi-cli/providers';

type SessionRow = typeof sessions.$inferSelect;

type DispatchOptions = {
	cfg: AGIConfig;
	db: DB;
	session: SessionRow;
	agent: string;
	provider: ProviderId;
	model: string;
	content: string;
	oneShot?: boolean;
};

export async function dispatchAssistantMessage(
	options: DispatchOptions,
): Promise<{ assistantMessageId: string }> {
	const { cfg, db, session, agent, provider, model, content, oneShot } =
		options;
	const sessionId = session.id;
	const now = Date.now();
	const userMessageId = crypto.randomUUID();

	await db.insert(messages).values({
		id: userMessageId,
		sessionId,
		role: 'user',
		status: 'complete',
		agent,
		provider,
		model,
		createdAt: now,
	});
	await db.insert(messageParts).values({
		id: crypto.randomUUID(),
		messageId: userMessageId,
		index: 0,
		type: 'text',
		content: JSON.stringify({ text: String(content) }),
		agent,
		provider,
		model,
	});
	publish({
		type: 'message.created',
		sessionId,
		payload: { id: userMessageId, role: 'user' },
	});

	enqueueSessionTitle({ cfg, db, sessionId, content });

	const assistantMessageId = crypto.randomUUID();
	await db.insert(messages).values({
		id: assistantMessageId,
		sessionId,
		role: 'assistant',
		status: 'pending',
		agent,
		provider,
		model,
		createdAt: Date.now(),
	});
	const assistantPartId = crypto.randomUUID();
	const startTs = Date.now();
	await db.insert(messageParts).values({
		id: assistantPartId,
		messageId: assistantMessageId,
		index: 0,
		stepIndex: 0,
		type: 'text',
		content: JSON.stringify({ text: '' }),
		agent,
		provider,
		model,
		startedAt: startTs,
	});
	publish({
		type: 'message.created',
		sessionId,
		payload: { id: assistantMessageId, role: 'assistant' },
	});

	enqueueAssistantRun({
		sessionId,
		assistantMessageId,
		assistantPartId,
		agent,
		provider,
		model,
		projectRoot: cfg.projectRoot,
		oneShot: Boolean(oneShot),
	});

	void touchSessionLastActive({ db, sessionId });

	return { assistantMessageId };
}

const TITLE_CONCURRENCY_LIMIT = 1;
const titleQueue: Array<() => void> = [];
let titleActiveCount = 0;
const titleInFlight = new Set<string>();
const titlePending = new Set<string>();

function scheduleSessionTitle(args: {
	cfg: AGIConfig;
	db: DB;
	sessionId: string;
	content: unknown;
}): void {
	const { sessionId } = args;
	if (titleInFlight.has(sessionId)) return;
	titleInFlight.add(sessionId);
	void (async () => {
		try {
			const alreadyTitled = await sessionHasTitle(args.db, sessionId);
			if (alreadyTitled) return;
			await withTitleSlot(() => updateSessionTitle(args));
		} catch {
			// Swallow title generation errors; they are non-blocking.
		} finally {
			titleInFlight.delete(sessionId);
		}
	})();
}

function enqueueSessionTitle(args: {
	cfg: AGIConfig;
	db: DB;
	sessionId: string;
	content: unknown;
}) {
	const { sessionId } = args;
	if (titlePending.has(sessionId) || titleInFlight.has(sessionId)) return;
	titlePending.add(sessionId);
	Promise.resolve()
		.then(() => {
			titlePending.delete(sessionId);
			scheduleSessionTitle(args);
		})
		.catch(() => {
			titlePending.delete(sessionId);
		});
}

async function updateSessionTitle(args: {
	cfg: AGIConfig;
	db: DB;
	sessionId: string;
	content: unknown;
}) {
	const { cfg, db, sessionId, content } = args;
	try {
		const rows = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId));
		if (!rows.length) return;
		const current = rows[0];
		const alreadyHasTitle =
			current.title != null && String(current.title).trim().length > 0;
		let heuristic = '';
		if (!alreadyHasTitle) {
			heuristic = deriveTitle(String(content ?? ''));
			if (heuristic) {
				await db
					.update(sessions)
					.set({ title: heuristic })
					.where(eq(sessions.id, sessionId));
				publish({
					type: 'session.updated',
					sessionId,
					payload: { title: heuristic },
				});
			}
		}

		const model = await resolveModel(
			(current.provider as ProviderId) ?? cfg.defaults.provider,
			current.model ?? cfg.defaults.model,
			cfg,
		);
		const promptText = String(content ?? '').slice(0, 2000);
		const sys = [
			"Create a short, descriptive session title from the user's request.",
			'Max 6–8 words. No quotes. No trailing punctuation.',
			'Avoid generic phrases like "help me"; be specific.',
		].join(' ');
		let modelTitle = '';
		try {
			const out = await generateText({
				model,
				system: sys,
				prompt: promptText,
			});
			modelTitle = (out?.text || '').trim();
		} catch {}
		if (!modelTitle) return;
		modelTitle = sanitizeTitle(modelTitle);
		if (!modelTitle) return;

		const check = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId));
		if (!check.length) return;
		const currentTitle = String(check[0].title ?? '').trim();
		if (currentTitle && currentTitle !== heuristic) return;
		await db
			.update(sessions)
			.set({ title: modelTitle })
			.where(eq(sessions.id, sessionId));
		publish({
			type: 'session.updated',
			sessionId,
			payload: { title: modelTitle },
		});
	} catch {}
}

async function withTitleSlot<T>(fn: () => Promise<T>): Promise<T> {
	await acquireTitleSlot();
	try {
		return await fn();
	} finally {
		releaseTitleSlot();
	}
}

async function sessionHasTitle(db: DB, sessionId: string): Promise<boolean> {
	try {
		const rows = await db
			.select({ title: sessions.title })
			.from(sessions)
			.where(eq(sessions.id, sessionId))
			.limit(1);
		if (!rows.length) return false;
		const title = rows[0]?.title;
		return typeof title === 'string' && title.trim().length > 0;
	} catch {
		return false;
	}
}

function acquireTitleSlot(): Promise<void> {
	if (titleActiveCount < TITLE_CONCURRENCY_LIMIT) {
		titleActiveCount += 1;
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		titleQueue.push(() => {
			titleActiveCount += 1;
			resolve();
		});
	});
}

function releaseTitleSlot(): void {
	if (titleActiveCount > 0) titleActiveCount -= 1;
	const next = titleQueue.shift();
	if (next) {
		next();
	}
}

async function touchSessionLastActive(args: { db: DB; sessionId: string }) {
	const { db, sessionId } = args;
	try {
		await db
			.update(sessions)
			.set({ lastActiveAt: Date.now() })
			.where(eq(sessions.id, sessionId));
	} catch {}
}

function deriveTitle(text: string): string {
	const cleaned = String(text || '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!cleaned) return '';
	const endIdx = (() => {
		const punct = ['? ', '. ', '! ']
			.map((p) => cleaned.indexOf(p))
			.filter((i) => i > 0);
		const idx = Math.min(...(punct.length ? punct : [cleaned.length]));
		return Math.min(idx + 1, cleaned.length);
	})();
	const first = cleaned.slice(0, endIdx).trim();
	const maxLen = 64;
	const base = first.length > 8 ? first : cleaned;
	const truncated =
		base.length > maxLen ? `${base.slice(0, maxLen - 1).trimEnd()}…` : base;
	return truncated;
}

function sanitizeTitle(s: string): string {
	let t = s.trim();
	t = t.replace(/^['"“”‘’()[\]]+|['"“”‘’()[\]]+$/g, '').trim();
	t = t.replace(/[\s\-_:–—]+$/g, '').trim();
	if (t.length > 64) t = `${t.slice(0, 63).trimEnd()}…`;
	return t;
}
