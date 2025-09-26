import { eq } from 'drizzle-orm';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import {
	createSession,
	getLastSession,
	getSessionById,
} from '@/server/runtime/sessionManager.ts';
import { selectProviderAndModel } from '@/server/runtime/providerSelection.ts';
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
	const projectRoot = request.projectRoot || process.cwd();
	const cfg = await loadConfig(projectRoot);
	const db = await getDb(cfg.projectRoot);

	let session: SessionRow | undefined;
	let messageIndicator: AskServerResponse['message'];

	if (request.sessionId) {
		session = await getSessionById({
			db,
			projectPath: cfg.projectRoot,
			sessionId: request.sessionId,
		});
		if (!session) throw new Error(`Session not found: ${request.sessionId}`);
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

	const agentCfg = await resolveAgentConfig(cfg.projectRoot, agentName);
	const agentProviderDefault = isProviderId(agentCfg.provider)
		? agentCfg.provider
		: cfg.defaults.provider;
	const agentModelDefault = agentCfg.model ?? cfg.defaults.model;

	const explicitProvider = isProviderId(request.provider)
		? (request.provider as ProviderId)
		: undefined;

	const providerSelection = await selectProviderAndModel({
		cfg,
		agentProviderDefault,
		agentModelDefault,
		explicitProvider,
		explicitModel: request.model,
	});

	if (!session) {
		const newSession = await createSession({
			db,
			cfg,
			agent: agentName,
			provider: providerSelection.provider,
			model: providerSelection.model,
			title: null,
		});
		session = newSession;
		messageIndicator = { kind: 'created', sessionId: newSession.id };
	}
	if (!session) throw new Error('Failed to resolve or create session.');

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
