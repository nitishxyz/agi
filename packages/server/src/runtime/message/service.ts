import { generateText, streamText } from 'ai';
import { eq, asc } from 'drizzle-orm';
import type { OttoConfig } from '@ottocode/sdk';
import type { DB } from '@ottocode/database';
import { messages, messageParts, sessions } from '@ottocode/database/schema';
import { publish } from '../../events/bus.ts';
import { enqueueAssistantRun } from '../session/queue.ts';
import { runSessionLoop } from '../agent/runner.ts';
import { resolveModel } from '../provider/index.ts';
import {
	getFastModelForAuth,
	type ProviderId,
	type ReasoningLevel,
} from '@ottocode/sdk';
import { isCompactCommand, buildCompactionContext } from './compaction.ts';
import { detectOAuth, adaptSimpleCall } from '../provider/oauth-adapter.ts';

type SessionRow = typeof sessions.$inferSelect;

type DispatchOptions = {
	cfg: OttoConfig;
	db: DB;
	session: SessionRow;
	agent: string;
	provider: ProviderId;
	model: string;
	content: string;
	oneShot?: boolean;
	userContext?: string;
	reasoningText?: boolean;
	reasoningLevel?: ReasoningLevel;
	images?: Array<{ data: string; mediaType: string }>;
	files?: Array<{
		type: 'image' | 'pdf' | 'text';
		name: string;
		data: string;
		mediaType: string;
		textContent?: string;
	}>;
};

export async function dispatchAssistantMessage(
	options: DispatchOptions,
): Promise<{ assistantMessageId: string }> {
	const {
		cfg,
		db,
		session,
		agent,
		provider,
		model,
		content,
		oneShot,
		userContext,
		reasoningText,
		reasoningLevel,
		images,
		files,
	} = options;

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

	if (images && images.length > 0) {
		for (let i = 0; i < images.length; i++) {
			const img = images[i];
			await db.insert(messageParts).values({
				id: crypto.randomUUID(),
				messageId: userMessageId,
				index: i + 1,
				type: 'image',
				content: JSON.stringify({ data: img.data, mediaType: img.mediaType }),
				agent,
				provider,
				model,
			});
		}
	}

	let nextIndex = (images?.length ?? 0) + 1;
	if (files && files.length > 0) {
		for (const file of files) {
			const partType = file.type === 'image' ? 'image' : 'file';
			await db.insert(messageParts).values({
				id: crypto.randomUUID(),
				messageId: userMessageId,
				index: nextIndex++,
				type: partType,
				content: JSON.stringify({
					type: file.type,
					name: file.name,
					data: file.data,
					mediaType: file.mediaType,
					textContent: file.textContent,
				}),
				agent,
				provider,
				model,
			});
		}
	}

	publish({
		type: 'message.created',
		sessionId,
		payload: {
			id: userMessageId,
			role: 'user',
			agent,
			provider,
			model,
			content: String(content),
		},
	});

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
	publish({
		type: 'message.created',
		sessionId,
		payload: {
			id: assistantMessageId,
			role: 'assistant',
			agent,
			provider,
			model,
		},
	});

	const isCompact = isCompactCommand(content);
	let compactionContext: string | undefined;

	if (isCompact) {
		const { getModelLimits } = await import('./compaction.ts');
		const limits = getModelLimits(provider, model);
		const contextTokenLimit = limits
			? Math.max(Math.floor(limits.context * 0.5), 15000)
			: 15000;
		compactionContext = await buildCompactionContext(
			db,
			sessionId,
			contextTokenLimit,
		);
	}

	const toolApprovalMode = cfg.defaults.toolApproval ?? 'dangerous';

	enqueueAssistantRun(
		{
			sessionId,
			assistantMessageId,
			agent,
			provider,
			model,
			projectRoot: cfg.projectRoot,
			oneShot: Boolean(oneShot),
			userContext,
			reasoningText,
			reasoningLevel,
			isCompactCommand: isCompact,
			compactionContext,
			toolApprovalMode,
		},
		runSessionLoop,
	);

	void touchSessionLastActive({ db, sessionId });

	return { assistantMessageId };
}

const TITLE_CONCURRENCY_LIMIT = 1;
const titleQueue: Array<() => void> = [];
let titleActiveCount = 0;
const titleInFlight = new Set<string>();
const titlePending = new Set<string>();

function scheduleSessionTitle(args: {
	cfg: OttoConfig;
	db: DB;
	sessionId: string;
	content: unknown;
}) {
	const { cfg, db, sessionId, content } = args;

	if (titleInFlight.has(sessionId) || titlePending.has(sessionId)) {
		return;
	}

	const processNext = () => {
		if (titleQueue.length === 0) {
			return;
		}
		if (titleActiveCount >= TITLE_CONCURRENCY_LIMIT) {
			return;
		}
		const next = titleQueue.shift();
		if (!next) return;
		titleActiveCount++;
		next();
	};

	const task = async () => {
		titleInFlight.add(sessionId);
		titlePending.delete(sessionId);
		try {
			await generateSessionTitle({ cfg, db, sessionId, content });
		} catch {
		} finally {
			titleInFlight.delete(sessionId);
			titleActiveCount--;
			processNext();
		}
	};

	titlePending.add(sessionId);
	titleQueue.push(task);
	processNext();
}

function enqueueSessionTitle(args: {
	cfg: OttoConfig;
	db: DB;
	sessionId: string;
	content: unknown;
}) {
	scheduleSessionTitle(args);
}

async function generateSessionTitle(args: {
	cfg: OttoConfig;
	db: DB;
	sessionId: string;
	content: unknown;
}): Promise<void> {
	const { cfg, db, sessionId, content } = args;

	try {
		const existingSession = await db
			.select()
			.from(sessions)
			.where(eq(sessions.id, sessionId));

		if (!existingSession.length) {
			return;
		}

		const sess = existingSession[0];
		if (sess.title && sess.title !== 'New Session') {
			return;
		}

		const provider = (sess.provider ?? cfg.defaults.provider) as ProviderId;
		const modelName = sess.model ?? cfg.defaults.model;

		const { getAuth } = await import('@ottocode/sdk');
		const auth = await getAuth(provider, cfg.projectRoot);
		const oauth = detectOAuth(provider, auth);

		const titleModel = getFastModelForAuth(provider, auth?.type) ?? modelName;
		const model = await resolveModel(provider, titleModel, cfg);

		const promptText = String(content ?? '').slice(0, 2000);

		const titleInstructions = `Generate a brief title (6-8 words) summarizing what the user wants to do.
Rules: Plain text only. No markdown, no quotes, no punctuation, no emojis.
Focus on the core task or topic. Be specific but concise.
Examples: "Fix TypeScript build errors", "Add dark mode toggle", "Refactor auth middleware"

Output ONLY the title, nothing else.`;

		const adapted = adaptSimpleCall(oauth, {
			instructions: titleInstructions,
			userContent: promptText,
		});

		let modelTitle = '';
		try {
			if (adapted.forceStream || oauth.needsSpoof) {
				const result = streamText({
					model,
					system: adapted.system,
					messages: adapted.messages,
					providerOptions: adapted.providerOptions,
				});
				for await (const chunk of result.textStream) {
					modelTitle += chunk;
				}
				modelTitle = modelTitle.trim();
			} else {
				const out = await generateText({
					model,
					system: adapted.system,
					messages: adapted.messages,
				});
				modelTitle = (out?.text || '').trim();
			}
		} catch {}

		if (!modelTitle) {
			return;
		}

		const sanitized = sanitizeTitle(modelTitle);

		if (!sanitized || sanitized === 'New Session') {
			return;
		}

		await db
			.update(sessions)
			.set({ title: sanitized, lastActiveAt: Date.now() })
			.where(eq(sessions.id, sessionId));

		publish({
			type: 'session.updated',
			sessionId,
			payload: { id: sessionId, title: sanitized },
		});
	} catch {}
}

function sanitizeTitle(raw: string): string {
	let s = raw.trim();
	s = s.replace(/^#+\s*/, '');
	s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
	s = s.replace(/\*([^*]+)\*/g, '$1');
	s = s.replace(/__([^_]+)__/g, '$1');
	s = s.replace(/_([^_]+)_/g, '$1');
	s = s.replace(/`([^`]+)`/g, '$1');
	s = s.replace(/~~([^~]+)~~/g, '$1');
	s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
	s = s.replace(/^["']|["']$/g, '');
	s = s.replace(/^[-–—•*]\s*/, '');
	s = s.replace(/[.!?:;,]+$/, '');
	s = s.replace(/\s+/g, ' ');
	if (s.length > 80) s = s.slice(0, 80).trim();
	return s;
}

async function touchSessionLastActive(args: {
	db: DB;
	sessionId: string;
}): Promise<void> {
	const { db, sessionId } = args;
	try {
		await db
			.update(sessions)
			.set({ lastActiveAt: Date.now() })
			.where(eq(sessions.id, sessionId))
			.run();
	} catch {}
}

export async function triggerDeferredTitleGeneration(args: {
	cfg: OttoConfig;
	db: DB;
	sessionId: string;
}): Promise<void> {
	const { cfg, db, sessionId } = args;

	try {
		const userMessages = await db
			.select()
			.from(messages)
			.where(eq(messages.sessionId, sessionId))
			.orderBy(asc(messages.createdAt))
			.limit(1);

		if (!userMessages.length || userMessages[0].role !== 'user') {
			return;
		}

		const parts = await db
			.select()
			.from(messageParts)
			.where(eq(messageParts.messageId, userMessages[0].id))
			.orderBy(asc(messageParts.index))
			.limit(1);

		if (!parts.length) {
			return;
		}

		let content = '';
		try {
			const parsed = JSON.parse(parts[0].content ?? '{}');
			content = String(parsed.text ?? '');
		} catch {
			return;
		}

		if (!content) {
			return;
		}
		enqueueSessionTitle({ cfg, db, sessionId, content });
	} catch {}
}
