import type {
	Agent,
	AgentSideConnection,
	InitializeRequest,
	InitializeResponse,
	NewSessionRequest,
	NewSessionResponse,
	PromptRequest,
	PromptResponse,
	CancelNotification,
	AuthenticateRequest,
	AuthenticateResponse,
	ClientCapabilities,
	LoadSessionRequest,
	LoadSessionResponse,
	ListSessionsRequest,
	ListSessionsResponse,
	ResumeSessionRequest,
	ResumeSessionResponse,
	CloseSessionRequest,
	CloseSessionResponse,
	SetSessionModeRequest,
	SetSessionModeResponse,
	SetSessionModelRequest,
	SetSessionModelResponse,
	SetSessionConfigOptionRequest,
	SetSessionConfigOptionResponse,
} from '@agentclientprotocol/sdk';
import { handleAskRequest } from '@ottocode/server/runtime/ask/service';
import { subscribe } from '@ottocode/server/events/bus';
import {
	abortMessage,
	getRunnerState,
} from '@ottocode/server/runtime/agent/runner';
import {
	createSession,
	getSessionById,
	listSessions,
} from '@ottocode/server/runtime/session/manager';
import { getDb } from '@ottocode/database';
import { loadConfig } from '@ottocode/sdk';
import { randomUUID } from 'node:crypto';
import { queueAvailableCommands } from './available-commands';
import { parseModelId } from './model';
import { handleOttoEvent } from './events';
import { replaySessionHistory } from './history';
import { buildSessionState, loadSessionDefaults } from './session-state';
import {
	handleMcpCommand,
	handleReasoningCommand,
	handleShareCommand,
	handleStageCommand,
} from './slash-commands';
import { ACP_VERSION, DEFAULT_MODE, type AcpSession } from './types';

export class OttoAcpAgent implements Agent {
	private client: AgentSideConnection;
	private sessions = new Map<string, AcpSession>();
	private clientCapabilities?: ClientCapabilities;

	constructor(client: AgentSideConnection) {
		this.client = client;
	}

	async initialize(request: InitializeRequest): Promise<InitializeResponse> {
		this.clientCapabilities = request.clientCapabilities;

		return {
			protocolVersion: 1,
			agentCapabilities: {
				loadSession: true,
				sessionCapabilities: {
					list: {},
					resume: {},
					close: {},
					additionalDirectories: {},
				},
				mcpCapabilities: {
					http: true,
					sse: true,
				},
				promptCapabilities: {
					image: true,
					embeddedContext: true,
				},
			},
			agentInfo: {
				name: 'otto',
				title: 'Otto',
				version: ACP_VERSION,
			},
			authMethods: [],
		};
	}

	async authenticate(
		_params: AuthenticateRequest,
	): Promise<AuthenticateResponse | undefined> {
		return undefined;
	}

	async newSession(params: NewSessionRequest): Promise<NewSessionResponse> {
		const cwd = params.cwd || process.cwd();
		const defaults = await loadSessionDefaults(cwd);
		let sessionId: string = randomUUID();
		let ottoSessionId = '';

		try {
			const cfg = await loadConfig(cwd);
			const db = await getDb(cfg.projectRoot);
			const row = await createSession({
				db,
				cfg,
				agent: defaults.agent,
				provider: defaults.provider,
				model: defaults.model,
			});
			sessionId = row.id;
			ottoSessionId = row.id;
		} catch (err) {
			console.error('[acp] Failed to create resumable session:', err);
		}

		const session: AcpSession = {
			sessionId,
			ottoSessionId,
			cwd,
			cancelled: false,
			assistantMessageId: null,
			resolvePrompt: null,
			unsubscribe: null,
			sessionInfoUnsubscribe: null,
			activeTerminals: new Map(),
			mode: defaults.agent,
			provider: defaults.provider,
			model: defaults.model,
			mcpServers: params.mcpServers ?? [],
			additionalDirectories: normalizeAdditionalDirectories(params),
		};

		this.sessions.set(sessionId, session);
		this.subscribeSessionInfoUpdates(sessionId, session);
		const state = await buildSessionState(session);
		queueAvailableCommands(this.client, sessionId);

		return {
			sessionId,
			...state,
		};
	}

	async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
		const response = await this.resumeExistingSession(
			params.sessionId,
			params.cwd,
			params.mcpServers,
		);
		const session = this.sessions.get(params.sessionId);
		if (!session) throw new Error('Session not found');
		await replaySessionHistory(this.client, params.sessionId, session);
		queueAvailableCommands(this.client, params.sessionId);
		return response;
	}

	async listSessions(
		params: ListSessionsRequest,
	): Promise<ListSessionsResponse> {
		const cwd = params.cwd || process.cwd();
		const cfg = await loadConfig(cwd);
		const db = await getDb(cfg.projectRoot);
		const rows = await listSessions({
			db,
			projectPath: cfg.projectRoot,
			limit: 100,
		});

		return {
			sessions: rows.map((row) => ({
				sessionId: row.id,
				cwd: row.projectPath,
				title: row.title ?? `${row.agent} · ${row.model}`,
				updatedAt: new Date(row.lastActiveAt ?? row.createdAt).toISOString(),
			})),
		};
	}

	async resumeSession(
		params: ResumeSessionRequest,
	): Promise<ResumeSessionResponse> {
		const response = await this.resumeExistingSession(
			params.sessionId,
			params.cwd,
			params.mcpServers ?? [],
		);
		queueAvailableCommands(this.client, params.sessionId);
		return response;
	}

	async closeSession(
		params: CloseSessionRequest,
	): Promise<CloseSessionResponse | undefined> {
		const session = this.sessions.get(params.sessionId);
		if (!session) return undefined;
		await this.cancel({ sessionId: params.sessionId });
		session.unsubscribe?.();
		session.sessionInfoUnsubscribe?.();
		for (const terminal of session.activeTerminals.values()) {
			await terminal.release().catch(() => undefined);
		}
		this.sessions.delete(params.sessionId);
		return undefined;
	}

	async setSessionMode(
		params: SetSessionModeRequest,
	): Promise<SetSessionModeResponse | undefined> {
		const session = this.sessions.get(params.sessionId);
		if (!session) throw new Error('Session not found');
		session.mode = params.modeId;
		await this.client.sessionUpdate({
			sessionId: params.sessionId,
			update: {
				sessionUpdate: 'current_mode_update',
				currentModeId: params.modeId,
			},
		});
		return undefined;
	}

	async unstable_setSessionModel(
		params: SetSessionModelRequest,
	): Promise<SetSessionModelResponse | undefined> {
		const session = this.sessions.get(params.sessionId);
		if (!session) throw new Error('Session not found');
		const parsed = parseModelId(params.modelId);
		session.provider = parsed.provider;
		session.model = parsed.model;
		return undefined;
	}

	async setSessionConfigOption(
		params: SetSessionConfigOptionRequest,
	): Promise<SetSessionConfigOptionResponse> {
		const session = this.sessions.get(params.sessionId);
		if (!session) throw new Error('Session not found');

		if (params.configId === 'agent' && 'value' in params) {
			session.mode = String(params.value);
		} else if (params.configId === 'model' && 'value' in params) {
			const parsed = parseModelId(String(params.value));
			session.provider = parsed.provider;
			session.model = parsed.model;
		}

		const state = await buildSessionState(session);
		return { configOptions: state.configOptions ?? [] };
	}

	async prompt(params: PromptRequest): Promise<PromptResponse> {
		const session = this.sessions.get(params.sessionId);
		if (!session) {
			throw new Error('Session not found');
		}

		session.cancelled = false;

		const textParts: string[] = [];
		const images: Array<{ data: string; mediaType: string }> = [];
		for (const chunk of params.prompt) {
			if (chunk.type === 'text') {
				textParts.push(chunk.text);
			} else if (chunk.type === 'image') {
				images.push({ data: chunk.data, mediaType: chunk.mimeType });
				if (chunk.uri) {
					textParts.push(
						`<image uri="${chunk.uri}" mimeType="${chunk.mimeType}" />`,
					);
				}
			} else if (chunk.type === 'resource' && 'text' in chunk.resource) {
				textParts.push(
					`<context uri="${chunk.resource.uri}">\n${chunk.resource.text}\n</context>`,
				);
			} else if (chunk.type === 'resource_link') {
				const context = await this.resolveResourceLink(
					chunk.uri,
					params.sessionId,
				);
				textParts.push(context ?? `@${chunk.uri}`);
			}
		}
		const prompt = textParts.join('\n');
		const trimmedPrompt = prompt.trim();
		if (trimmedPrompt === '/share') {
			return handleShareCommand(this.client, params.sessionId, session);
		}
		if (
			trimmedPrompt === '/reasoning' ||
			trimmedPrompt.startsWith('/reasoning ')
		) {
			return handleReasoningCommand(
				this.client,
				params.sessionId,
				session,
				trimmedPrompt,
			);
		}
		if (trimmedPrompt === '/stage' || trimmedPrompt.startsWith('/stage ')) {
			return handleStageCommand(
				this.client,
				params.sessionId,
				session,
				trimmedPrompt,
			);
		}
		if (trimmedPrompt === '/mcp' || trimmedPrompt.startsWith('/mcp ')) {
			return handleMcpCommand(
				this.client,
				params.sessionId,
				session,
				trimmedPrompt,
			);
		}

		let unsub: (() => void) | null = null;
		const subscribeToPromptEvents = (ottoSessionId: string) => {
			if (unsub) return;
			unsub = subscribe(ottoSessionId, (event) => {
				if (event.type === 'session.updated') return;
				const currentSession = this.sessions.get(params.sessionId);
				if (!currentSession) return;
				void handleOttoEvent(
					this.client,
					this.clientCapabilities,
					event,
					params.sessionId,
					currentSession,
				);
			});
			session.unsubscribe = unsub;
		};

		if (session.ottoSessionId) {
			subscribeToPromptEvents(session.ottoSessionId);
		}

		let response: Awaited<ReturnType<typeof handleAskRequest>>;
		try {
			response = await handleAskRequest({
				projectRoot: session.cwd,
				prompt,
				sessionId: session.ottoSessionId || undefined,
				agent: session.mode,
				provider: session.provider,
				model: session.model,
				images,
			});
		} catch (err) {
			session.unsubscribe?.();
			session.unsubscribe = null;
			const msg = err instanceof Error ? err.message : String(err);
			console.error('[acp] handleAskRequest failed:', msg);
			await this.client.sessionUpdate({
				sessionId: params.sessionId,
				update: {
					sessionUpdate: 'agent_message_chunk',
					content: {
						type: 'text',
						text: `Error: ${msg}\n\nMake sure you have a provider configured. Run \`otto auth\` to set up API keys.`,
					},
				},
			});
			return { stopReason: 'end_turn' };
		}

		session.ottoSessionId = response.sessionId;
		session.assistantMessageId = response.assistantMessageId;
		session.provider = response.provider;
		session.model = response.model;
		this.subscribeSessionInfoUpdates(params.sessionId, session);
		subscribeToPromptEvents(response.sessionId);

		return new Promise<PromptResponse>((resolve) => {
			session.resolvePrompt = resolve;

			const checkInterval = setInterval(() => {
				if (session.cancelled) {
					clearInterval(checkInterval);
					session.unsubscribe?.();
					session.unsubscribe = null;
					resolve({ stopReason: 'cancelled' });
					return;
				}

				if (!session.assistantMessageId) return;

				const state = getRunnerState(session.ottoSessionId);
				const isRunning = state?.running ?? false;
				const hasQueued = (state?.queue.length ?? 0) > 0;

				if (!isRunning && !hasQueued && session.assistantMessageId) {
					clearInterval(checkInterval);
					session.unsubscribe?.();
					session.unsubscribe = null;
					resolve({ stopReason: 'end_turn' });
				}
			}, 200);
		});
	}

	async cancel(params: CancelNotification): Promise<void> {
		const session = this.sessions.get(params.sessionId);
		if (!session) return;

		session.cancelled = true;

		if (session.ottoSessionId && session.assistantMessageId) {
			abortMessage(session.ottoSessionId, session.assistantMessageId);
		}
	}

	private async resumeExistingSession(
		sessionId: string,
		cwd: string,
		mcpServers: NewSessionRequest['mcpServers'] = [],
	): Promise<ResumeSessionResponse> {
		const db = await getDb(cwd);
		const row = await getSessionById({
			db,
			sessionId,
		});
		if (!row) {
			console.error('[acp] Session not found while resuming:', sessionId);
			throw new Error('Session not found');
		}

		const session: AcpSession = {
			sessionId,
			ottoSessionId: sessionId,
			cwd: row.projectPath || cwd,
			cancelled: false,
			assistantMessageId: null,
			resolvePrompt: null,
			unsubscribe: null,
			sessionInfoUnsubscribe: null,
			activeTerminals: new Map(),
			mode: row.agent || DEFAULT_MODE,
			provider: row.provider,
			model: row.model,
			mcpServers,
			additionalDirectories: [],
		};
		this.sessions.set(sessionId, session);
		this.subscribeSessionInfoUpdates(sessionId, session);

		return buildSessionState(session);
	}

	private subscribeSessionInfoUpdates(
		acpSessionId: string,
		session: AcpSession,
	) {
		if (!session.ottoSessionId || session.sessionInfoUnsubscribe) return;

		session.sessionInfoUnsubscribe = subscribe(
			session.ottoSessionId,
			(event) => {
				if (event.type !== 'session.updated') return;
				const currentSession = this.sessions.get(acpSessionId);
				if (!currentSession) return;
				void handleOttoEvent(
					this.client,
					this.clientCapabilities,
					event,
					acpSessionId,
					currentSession,
				);
			},
		);
	}

	private async resolveResourceLink(
		uri: string,
		sessionId: string,
	): Promise<string | undefined> {
		if (!this.clientCapabilities?.fs?.readTextFile) return undefined;
		if (!uri.startsWith('file://')) return undefined;

		try {
			const filePath = decodeURIComponent(new URL(uri).pathname);
			const response = await this.client.readTextFile({
				sessionId,
				path: filePath,
			});
			return `<context uri="${uri}">\n${response.content}\n</context>`;
		} catch (err) {
			console.error('[acp] Failed to read resource link:', uri, err);
			return undefined;
		}
	}
}

function normalizeAdditionalDirectories(
	params: NewSessionRequest | ResumeSessionRequest | LoadSessionRequest,
): string[] {
	const dirs =
		'additionalDirectories' in params ? params.additionalDirectories : [];
	return Array.isArray(dirs)
		? dirs.filter((dir) => typeof dir === 'string')
		: [];
}
