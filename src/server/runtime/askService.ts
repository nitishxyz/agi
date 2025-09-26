import { eq } from 'drizzle-orm';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import {
	createSession,
	getLastSession,
	getSessionById,
} from '@/server/runtime/sessionManager.ts';
import {
	selectProviderAndModel,
	type ProviderSelection,
} from '@/server/runtime/providerSelection.ts';
import { resolveAgentConfig } from '@/ai/agents/registry.ts';
import { dispatchAssistantMessage } from '@/server/runtime/messageService.ts';
import { validateProviderModel } from '@/providers/validate.ts';
import {
	isProviderAuthorized,
	ensureProviderEnv,
} from '@/providers/authorization.ts';
import type { ProviderId } from '@/providers/catalog.ts';
import { isProviderId } from '@/providers/utils.ts';
import { sessions } from '@/db/schema/index.ts';
import { time } from '@/runtime/debug.ts';

export class AskServiceError extends Error {
	status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}

export type AskServerRequest = {
	projectRoot?: string;
	prompt: string;
	agent?: string;
	provider?: string;
	model?: string;
	sessionId?: string;
	last?: boolean;
	jsonMode?: boolean;
};

export type AskServerResponse = {
	sessionId: string;
	header: {
		agent?: string;
		provider?: string;
		model?: string;
		sessionId: string;
	};
	provider: ProviderId;
	model: string;
	agent: string;
	assistantMessageId: string;
	message?: { kind: 'created' | 'last'; sessionId: string };
};

type SessionRow = typeof import('@/db/schema/index.ts').sessions.$inferSelect;

export async function handleAskRequest(
	request: AskServerRequest,
): Promise<AskServerResponse> {
	try {
		return await processAskRequest(request);
	} catch (err) {
		throw normalizeAskServiceError(err);
	}
}

async function processAskRequest(
	request: AskServerRequest,
): Promise<AskServerResponse> {
	const projectRoot = request.projectRoot || process.cwd();
	const configTimer = time('ask:loadConfig+db');
	const cfg = await loadConfig(projectRoot);
	const db = await getDb(cfg.projectRoot);
	configTimer.end();

	let session: SessionRow | undefined;
	let messageIndicator: AskServerResponse['message'];

	if (request.sessionId) {
		session = await getSessionById({
			db,
			projectPath: cfg.projectRoot,
			sessionId: request.sessionId,
		});
		if (!session) {
			throw new AskServiceError(`Session not found: ${request.sessionId}`, 404);
		}
	} else if (request.last) {
		session = await getLastSession({ db, projectPath: cfg.projectRoot });
		if (session) {
			messageIndicator = { kind: 'last', sessionId: session.id };
		}
	} else {
		session = undefined;
	}

	const agentName = (() => {
		if (request.agent) return request.agent;
		if (session?.agent) return session.agent;
		return cfg.defaults.agent;
	})();

	const agentTimer = time('ask:resolveAgentConfig');
	const agentCfg = await resolveAgentConfig(cfg.projectRoot, agentName);
	agentTimer.end({ agent: agentName });
	const agentProviderDefault = isProviderId(agentCfg.provider)
		? agentCfg.provider
		: cfg.defaults.provider;
	const agentModelDefault = agentCfg.model ?? cfg.defaults.model;

	const explicitProvider = isProviderId(request.provider)
		? (request.provider as ProviderId)
		: undefined;

	let providerSelection: ProviderSelection;
	const selectTimer = time('ask:selectProviderModel');
	try {
		providerSelection = await selectProviderAndModel({
			cfg,
			agentProviderDefault,
			agentModelDefault,
			explicitProvider,
			explicitModel: request.model,
		});
		selectTimer.end({ provider: providerSelection.provider });
	} catch (err) {
		selectTimer.end();
		throw normalizeAskServiceError(err);
	}

	if (!session) {
		const createTimer = time('ask:createSession');
		const newSession = await createSession({
			db,
			cfg,
			agent: agentName,
			provider: providerSelection.provider,
			model: providerSelection.model,
			title: null,
		});
		createTimer.end();
		session = newSession;
		messageIndicator = { kind: 'created', sessionId: newSession.id };
	}
	if (!session)
		throw new AskServiceError('Failed to resolve or create session.', 500);

	const overridesProvided = Boolean(request.provider || request.model);

	let providerForMessage: ProviderId;
	let modelForMessage: string;

	if (overridesProvided) {
		providerForMessage = providerSelection.provider;
		modelForMessage = providerSelection.model;
	} else if (session.provider && session.model) {
		const sessionProvider = isProviderId(session.provider)
			? (session.provider as ProviderId)
			: agentProviderDefault;
		providerForMessage = sessionProvider;
		modelForMessage = session.model;
	} else {
		providerForMessage = providerSelection.provider;
		modelForMessage = providerSelection.model;
	}

	const providerAuthorized = await isProviderAuthorized(
		cfg,
		providerForMessage,
	);
	let fellBackToSelection = false;
	if (!providerAuthorized) {
		providerForMessage = providerSelection.provider;
		modelForMessage = providerSelection.model;
		fellBackToSelection = true;
	}
	if (
		session &&
		fellBackToSelection &&
		(session.provider !== providerForMessage ||
			session.model !== modelForMessage)
	) {
		await db
			.update(sessions)
			.set({ provider: providerForMessage, model: modelForMessage })
			.where(eq(sessions.id, session.id));
		session = {
			...session,
			provider: providerForMessage,
			model: modelForMessage,
		} as SessionRow;
	}

	validateProviderModel(providerForMessage, modelForMessage);
	await ensureProviderEnv(cfg, providerForMessage);

	const assistantMessage = await dispatchAssistantMessage({
		cfg,
		db,
		session,
		agent: agentName,
		provider: providerForMessage,
		model: modelForMessage,
		content: request.prompt,
		oneShot: !request.sessionId && !request.last,
	});

	const headerAgent = session.agent ?? agentName;
	const headerProvider = providerForMessage;
	const headerModel = modelForMessage;

	return {
		sessionId: session.id,
		header: {
			agent: headerAgent,
			provider: headerProvider,
			model: headerModel,
			sessionId: session.id,
		},
		provider: providerForMessage,
		model: modelForMessage,
		agent: agentName,
		assistantMessageId: assistantMessage.assistantMessageId,
		message: messageIndicator,
	};
}

function normalizeAskServiceError(err: unknown): AskServiceError {
	if (err instanceof AskServiceError) return err;
	if (err instanceof Error) {
		const status = inferStatus(err);
		const message = err.message || 'Unknown error';
		return new AskServiceError(message, status);
	}
	return new AskServiceError(String(err ?? 'Unknown error'));
}

export function inferStatus(err: Error): number {
	const anyErr = err as { status?: unknown; code?: unknown };
	if (typeof anyErr.status === 'number') {
		const s = anyErr.status;
		if (Number.isFinite(s) && s >= 400 && s < 600) return s;
	}
	if (typeof anyErr.code === 'number') {
		const s = anyErr.code;
		if (Number.isFinite(s) && s >= 400 && s < 600) return s;
	}
	const derived = deriveStatusFromMessage(err.message || '');
	return derived ?? 400;
}

const STATUS_PATTERNS: Array<{ regex: RegExp; status: number }> = [
	{ regex: /not found/i, status: 404 },
	{ regex: /missing credentials/i, status: 401 },
	{ regex: /unauthorized/i, status: 401 },
	{ regex: /not configured/i, status: 401 },
	{ regex: /authorized providers/i, status: 401 },
	{ regex: /forbidden/i, status: 403 },
	{ regex: /timeout/i, status: 504 },
];

export function deriveStatusFromMessage(message: string): number | undefined {
	const trimmed = message.trim();
	if (!trimmed) return undefined;
	for (const { regex, status } of STATUS_PATTERNS) {
		if (regex.test(trimmed)) return status;
	}
	return undefined;
}
