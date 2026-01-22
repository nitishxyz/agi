import { generateText, streamText } from 'ai';
import { eq } from 'drizzle-orm';
import type { AGIConfig } from '@agi-cli/sdk';
import type { DB } from '@agi-cli/database';
import { messages, messageParts, sessions } from '@agi-cli/database/schema';
import { publish } from '../../events/bus.ts';
import { enqueueAssistantRun } from '../session/queue.ts';
import { runSessionLoop } from '../agent/runner.ts';
import { resolveModel } from '../provider/index.ts';
import { getFastModelForAuth, type ProviderId } from '@agi-cli/sdk';
import { debugLog } from '../debug/index.ts';
import { isCompactCommand, buildCompactionContext } from './compaction.ts';

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
	reasoning?: boolean;
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
		reasoning,
		images,
		files,
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

	// Detect /compact command and build context with model-aware limits
	const isCompact = isCompactCommand(content);
	let compactionContext: string | undefined;

	if (isCompact) {
		debugLog('[MESSAGE_SERVICE] Detected /compact command, building context');
		const { getModelLimits } = await import('./compaction.ts');
		const limits = getModelLimits(provider, model);
		// Use 50% of context window for compaction, minimum 15k tokens
		const contextTokenLimit = limits
			? Math.max(Math.floor(limits.context * 0.5), 15000)
			: 15000;
		compactionContext = await buildCompactionContext(
			db,
			sessionId,
			contextTokenLimit,
		);
		debugLog(
			`[message-service] /compact context length: ${compactionContext.length}, limit: ${contextTokenLimit} tokens`,
		);
	}

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
			reasoning,
			isCompactCommand: isCompact,
			compactionContext,
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

		const { getAuth } = await import('@agi-cli/sdk');
		const { getProviderSpoofPrompt } = await import('../prompt/builder.ts');
		const auth = await getAuth(provider, cfg.projectRoot);
		const needsSpoof = auth?.type === 'oauth';
		const spoofPrompt = needsSpoof
			? getProviderSpoofPrompt(provider)
			: undefined;

		const titleModel = getFastModelForAuth(provider, auth?.type) ?? modelName;
		debugLog(`[TITLE_GEN] Using title model: ${titleModel}`);
		const model = await resolveModel(provider, titleModel, cfg);

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

			debugLog(
				`[TITLE_GEN] Using OAuth mode (prompts: spoof:${provider}, title-generator, user-request)`,
			);
			debugLog(
				`[TITLE_GEN] User content preview: ${promptText.substring(0, 100)}...`,
			);
		} else {
			// API key mode: normal flow
			system = titlePrompt;
			messagesArray = [{ role: 'user', content: promptText }];

			debugLog(
				`[TITLE_GEN] Using API key mode (prompts: title-generator, user-request)`,
			);
			debugLog(
				`[TITLE_GEN] User content preview: ${promptText.substring(0, 100)}...`,
			);
		}

		let modelTitle = '';
		try {
			// ChatGPT backend requires streaming - use streamText for OAuth
			if (needsSpoof) {
				debugLog('[TITLE_GEN] Using streamText for OAuth...');
				const result = streamText({
					model,
					system,
					messages: messagesArray,
				});
				for await (const chunk of result.textStream) {
					modelTitle += chunk;
				}
				modelTitle = modelTitle.trim();
			} else {
				debugLog('[TITLE_GEN] Using generateText...');
				const out = await generateText({
					model,
					system,
					messages: messagesArray,
				});
				modelTitle = (out?.text || '').trim();
			}

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
			.set({ lastActiveAt: Date.now() })
			.where(eq(sessions.id, sessionId))
			.run();
	} catch (err) {
		debugLog('[touchSessionLastActive] Error:', err);
	}
}
