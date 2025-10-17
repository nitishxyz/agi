import { generateText } from 'ai';
import { eq } from 'drizzle-orm';
import type { AGIConfig } from '@agi-cli/sdk';
import type { DB } from '@agi-cli/database';
import { messages, messageParts, sessions } from '@agi-cli/database/schema';
import { publish } from '../events/bus.ts';
import { enqueueAssistantRun } from './session-queue.ts';
import { runSessionLoop } from './runner.ts';
import { resolveModel } from './provider.ts';
import type { ProviderId } from '@agi-cli/sdk';
import { debugLog } from './debug.ts';

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
	userContext?: string;
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
	} = options;

	// DEBUG: Log userContext in dispatch
	debugLog(
		`[MESSAGE_SERVICE] dispatchAssistantMessage called with userContext: ${userContext ? `${userContext.substring(0, 50)}...` : 'NONE'}`,
	);

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
	publish({
		type: 'message.created',
		sessionId,
		payload: { id: assistantMessageId, role: 'assistant' },
	});

	// DEBUG: Log before enqueue
	debugLog(
		`[MESSAGE_SERVICE] Enqueuing assistant run with userContext: ${userContext ? `${userContext.substring(0, 50)}...` : 'NONE'}`,
	);

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
	cfg: AGIConfig;
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
		} catch (err) {
			debugLog('[TITLE_GEN] Title generation error:');
			debugLog(err);
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
	cfg: AGIConfig;
	db: DB;
	sessionId: string;
	content: unknown;
}) {
	scheduleSessionTitle(args);
}

async function generateSessionTitle(args: {
	cfg: AGIConfig;
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
			debugLog('[TITLE_GEN] Session not found, aborting');
			return;
		}

		const sess = existingSession[0];
		if (sess.title && sess.title !== 'New Session') {
			debugLog('[TITLE_GEN] Session already has a title, skipping');
			return;
		}

		const provider = sess.provider ?? cfg.defaults.provider;
		const modelName = sess.model ?? cfg.defaults.model;

		debugLog('[TITLE_GEN] Generating title for session');
		debugLog(`[TITLE_GEN] Provider: ${provider}, Model: ${modelName}`);

		const model = await resolveModel(provider, modelName, cfg);

		const { getAuth } = await import('@agi-cli/sdk');
		const { getProviderSpoofPrompt } = await import('./prompt.ts');
		const auth = await getAuth(provider, cfg.projectRoot);
		const needsSpoof = auth?.type === 'oauth';
		const spoofPrompt = needsSpoof
			? getProviderSpoofPrompt(provider)
			: undefined;

		debugLog(
			`[TITLE_GEN] needsSpoof: ${needsSpoof}, spoofPrompt: ${spoofPrompt || 'NONE'}`,
		);

		const promptText = String(content ?? '').slice(0, 2000);

		const titlePrompt = [
			"Create a short, descriptive session title from the user's request.",
			'Max 6–8 words. No quotes. No trailing punctuation.',
			'Avoid generic phrases like "help me"; be specific.',
		].join(' ');

		// Build system prompt and messages
		// For OAuth: Keep spoof pure, add instructions to user message
		// For API key: Use instructions as system
		let system: string;
		let messagesArray: Array<{ role: 'user'; content: string }>;

		if (spoofPrompt) {
			// OAuth mode: spoof stays pure, instructions go in user message
			system = spoofPrompt;
			messagesArray = [
				{
					role: 'user',
					content: `${titlePrompt}\n\n${promptText}`,
				},
			];

			debugLog('[TITLE_GEN] Using OAuth mode:');
			debugLog(`[TITLE_GEN] System prompt (spoof): ${spoofPrompt}`);
			debugLog(`[TITLE_GEN] User message (instructions + content):`);
			debugLog(`[TITLE_GEN]   Instructions: ${titlePrompt}`);
			debugLog(`[TITLE_GEN]   Content: ${promptText.substring(0, 100)}...`);
		} else {
			// API key mode: normal flow
			system = titlePrompt;
			messagesArray = [{ role: 'user', content: promptText }];

			debugLog('[TITLE_GEN] Using API key mode:');
			debugLog(`[TITLE_GEN] System prompt: ${system}`);
			debugLog(`[TITLE_GEN] User message: ${promptText.substring(0, 100)}...`);
		}

		debugLog('[TITLE_GEN] Calling generateText...');
		let modelTitle = '';
		try {
			const out = await generateText({
				model,
				system,
				messages: messagesArray,
			});
			modelTitle = (out?.text || '').trim();

			debugLog('[TITLE_GEN] Raw response from model:');
			debugLog(`[TITLE_GEN] "${modelTitle}"`);
		} catch (err) {
			debugLog('[TITLE_GEN] Error generating title:');
			debugLog(err);
		}

		if (!modelTitle) {
			debugLog('[TITLE_GEN] No title returned, aborting');
			return;
		}

		const sanitized = sanitizeTitle(modelTitle);
		debugLog(`[TITLE_GEN] After sanitization: "${sanitized}"`);

		if (!sanitized || sanitized === 'New Session') {
			debugLog('[TITLE_GEN] Sanitized title is empty or default, aborting');
			return;
		}

		await db
			.update(sessions)
			.set({ title: sanitized, updatedAt: Date.now() })
			.where(eq(sessions.id, sessionId));

		debugLog(`[TITLE_GEN] Setting final title: "${sanitized}"`);

		publish({
			type: 'session.updated',
			sessionId,
			payload: { id: sessionId, title: sanitized },
		});
	} catch (err) {
		debugLog('[TITLE_GEN] Error in generateSessionTitle:');
		debugLog(err);
	}
}

function sanitizeTitle(raw: string): string {
	let s = raw.trim();
	s = s.replace(/^["']|["']$/g, '');
	s = s.replace(/[.!?]+$/, '');
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
			.set({ updatedAt: Date.now() })
			.where(eq(sessions.id, sessionId))
			.run();
	} catch (err) {
		debugLog('[touchSessionLastActive] Error:', err);
	}
}
