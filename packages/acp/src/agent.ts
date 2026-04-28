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
	SessionNotification,
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
	SessionConfigOption,
	SessionModeState,
	SessionModelState,
	ToolKind,
	ToolCallLocation,
	ToolCallContent,
} from '@agentclientprotocol/sdk';
import { handleAskRequest } from '@ottocode/server/runtime/ask/service';
import { subscribe } from '@ottocode/server/events/bus';
import {
	abortMessage,
	getRunnerState,
} from '@ottocode/server/runtime/agent/runner';
import { resolveApproval } from '@ottocode/server/runtime/tools/approval';
import {
	createSession,
	getSessionHistoryMessages,
	getSessionById,
	listSessions,
} from '@ottocode/server/runtime/session/manager';
import { getDb } from '@ottocode/database';
import {
	getConfiguredProviderIds,
	getConfiguredProviderModels,
	isProviderAuthorized,
	loadConfig,
	type ProviderId,
} from '@ottocode/sdk';
import { randomUUID } from 'node:crypto';
import type { OttoEvent } from '@ottocode/server/events/types';
import * as path from 'node:path';
import * as fs from 'node:fs';

const ACP_VERSION = '0.1.196';
const DEFAULT_MODE = 'general';
const MODE_OPTIONS = [
	{ id: 'general', name: 'General', description: 'Default coding agent' },
	{ id: 'build', name: 'Build', description: 'Implementation-focused agent' },
	{ id: 'plan', name: 'Plan', description: 'Planning and analysis mode' },
	{ id: 'init', name: 'Init', description: 'Project initialization mode' },
];

type AcpSession = {
	sessionId: string;
	ottoSessionId: string;
	cwd: string;
	cancelled: boolean;
	assistantMessageId: string | null;
	resolvePrompt: ((response: PromptResponse) => void) | null;
	unsubscribe: (() => void) | null;
	activeTerminals: Map<
		string,
		{ terminalId: string; release: () => Promise<void> }
	>;
	mode: string;
	provider?: string;
	model?: string;
	mcpServers: NewSessionRequest['mcpServers'];
	additionalDirectories: string[];
};

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
					image: false,
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
		const defaults = await this.loadSessionDefaults(cwd);
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
			activeTerminals: new Map(),
			mode: defaults.agent,
			provider: defaults.provider,
			model: defaults.model,
			mcpServers: params.mcpServers ?? [],
			additionalDirectories: normalizeAdditionalDirectories(params),
		};

		this.sessions.set(sessionId, session);

		return {
			sessionId,
			...(await this.buildSessionState(session)),
		};
	}

	async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
		const response = await this.resumeExistingSession(
			params.sessionId,
			params.cwd,
			params.mcpServers,
		);
		await this.replaySessionHistory(params.sessionId);
		return response;
	}

	async listSessions(
		params: ListSessionsRequest,
	): Promise<ListSessionsResponse> {
		const cwd = params.cwd || process.cwd();
		const db = await getDb(cwd);
		const rows = await listSessions({
			db,
			projectPath: params.cwd ?? undefined,
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
		return this.resumeExistingSession(
			params.sessionId,
			params.cwd,
			params.mcpServers ?? [],
		);
	}

	async closeSession(
		params: CloseSessionRequest,
	): Promise<CloseSessionResponse | undefined> {
		const session = this.sessions.get(params.sessionId);
		if (!session) return undefined;
		await this.cancel({ sessionId: params.sessionId });
		session.unsubscribe?.();
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

		const state = await this.buildSessionState(session);
		return { configOptions: state.configOptions ?? [] };
	}

	async prompt(params: PromptRequest): Promise<PromptResponse> {
		const session = this.sessions.get(params.sessionId);
		if (!session) {
			throw new Error('Session not found');
		}

		session.cancelled = false;

		const textParts: string[] = [];
		for (const chunk of params.prompt) {
			if (chunk.type === 'text') {
				textParts.push(chunk.text);
			} else if (chunk.type === 'resource' && 'text' in chunk.resource) {
				textParts.push(
					`<context uri="${chunk.resource.uri}">\n${chunk.resource.text}\n</context>`,
				);
			} else if (chunk.type === 'resource_link') {
				const context = await this.resolveResourceLink(chunk.uri, params.sessionId);
				textParts.push(context ?? `@${chunk.uri}`);
			}
		}
		const prompt = textParts.join('\n');

		let response: Awaited<ReturnType<typeof handleAskRequest>>;
		try {
			response = await handleAskRequest({
				projectRoot: session.cwd,
				prompt,
				sessionId: session.ottoSessionId || undefined,
				agent: session.mode,
				provider: session.provider,
				model: session.model,
			});
		} catch (err) {
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

		const unsub = subscribe(response.sessionId, (event: OttoEvent) => {
			void this.handleOttoEvent(event, params.sessionId);
		});
		session.unsubscribe = unsub;

		return new Promise<PromptResponse>((resolve) => {
			session.resolvePrompt = resolve;

			const checkInterval = setInterval(() => {
				if (session.cancelled) {
					clearInterval(checkInterval);
					unsub();
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
					unsub();
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

	private async handleOttoEvent(
		event: OttoEvent,
		acpSessionId: string,
	): Promise<void> {
		const session = this.sessions.get(acpSessionId);
		if (!session || session.cancelled) return;

		const payload = event.payload as Record<string, unknown> | undefined;

		try {
			switch (event.type) {
				case 'message.part.delta': {
					const delta = typeof payload?.delta === 'string' ? payload.delta : '';
					if (delta && payload?.messageId === session.assistantMessageId) {
						await this.client.sessionUpdate({
							sessionId: acpSessionId,
							update: {
								sessionUpdate: 'agent_message_chunk',
								content: { type: 'text', text: delta },
							},
						});
					}
					break;
				}

				case 'reasoning.delta': {
					const delta = typeof payload?.delta === 'string' ? payload.delta : '';
					if (delta) {
						await this.client.sessionUpdate({
							sessionId: acpSessionId,
							update: {
								sessionUpdate: 'agent_thought_chunk',
								content: { type: 'text', text: delta },
							},
						});
					}
					break;
				}

				case 'tool.call': {
					await this.handleToolCall(payload, acpSessionId, session);
					break;
				}

				case 'tool.delta': {
					await this.handleToolDelta(payload, acpSessionId, session);
					break;
				}

				case 'tool.result': {
					await this.handleToolResult(payload, acpSessionId, session);
					break;
				}

				case 'plan.updated': {
					const items = payload?.items as
						| Array<{ step: string; status?: string }>
						| undefined;
					if (items) {
						await this.client.sessionUpdate({
							sessionId: acpSessionId,
							update: {
								sessionUpdate: 'plan',
								entries: items.map((item) => ({
									content: item.step,
									priority: 'medium',
									status: mapPlanStatus(item.status),
								})),
							},
						});
					}
					break;
				}

				case 'tool.approval.required': {
					const callId =
						typeof payload?.callId === 'string' ? payload.callId : undefined;
					const toolName =
						typeof payload?.toolName === 'string' ? payload.toolName : 'tool';

					if (!callId) break;

					const response = await this.client.requestPermission({
						options: [
							{
								kind: 'allow_once',
								name: 'Allow',
								optionId: 'allow',
							},
							{
								kind: 'reject_once',
								name: 'Reject',
								optionId: 'reject',
							},
						],
						sessionId: acpSessionId,
						toolCall: {
							toolCallId: callId,
							title: toolName,
							rawInput: payload?.args,
						},
					});

					const approved =
						response.outcome?.outcome === 'selected' &&
						response.outcome.optionId === 'allow';

					resolveApproval(callId, approved);
					return;
				}

				case 'message.completed': {
					if (
						payload?.id === session.assistantMessageId &&
						session.resolvePrompt
					) {
						const resolve = session.resolvePrompt;
						session.resolvePrompt = null;
						session.unsubscribe?.();
						session.unsubscribe = null;
						resolve({ stopReason: 'end_turn' });
					}
					return;
				}

				case 'error': {
					const errorText =
						typeof payload?.error === 'string'
							? payload.error
							: typeof payload?.message === 'string'
								? payload.message
								: 'Unknown error';

					await this.client.sessionUpdate({
						sessionId: acpSessionId,
						update: {
							sessionUpdate: 'agent_message_chunk',
							content: { type: 'text', text: `\n\nError: ${errorText}\n` },
						},
					});
					break;
				}

				default:
					return;
			}
		} catch (err) {
			console.error('[acp] Error handling event:', event.type, err);
		}
	}

	private async handleToolCall(
		payload: Record<string, unknown> | undefined,
		acpSessionId: string,
		session: AcpSession,
	): Promise<void> {
		const name = typeof payload?.name === 'string' ? payload.name : 'tool';
		const callId =
			typeof payload?.callId === 'string' ? payload.callId : randomUUID();
		const args = payload?.args as Record<string, unknown> | undefined;

		const kind = getToolKind(name);
		const locations = getToolLocations(name, args, session.cwd);

		await this.client.sessionUpdate({
			sessionId: acpSessionId,
			update: {
				toolCallId: callId,
				sessionUpdate: 'tool_call',
				title: formatToolTitle(name, args),
				kind,
				status: 'in_progress',
				rawInput: args,
				locations,
			} as SessionNotification['update'],
		});
	}

	private async handleToolDelta(
		payload: Record<string, unknown> | undefined,
		acpSessionId: string,
		_session: AcpSession,
	): Promise<void> {
		const callId =
			typeof payload?.callId === 'string' ? payload.callId : undefined;
		if (!callId) return;

		const name = typeof payload?.name === 'string' ? payload.name : '';
		const delta = payload?.delta;

		if (isShellTool(name) && typeof delta === 'string' && delta) {
			await this.client.sessionUpdate({
				sessionId: acpSessionId,
				update: {
					toolCallId: callId,
					sessionUpdate: 'tool_call_update',
					content: [
						{
							type: 'content',
							content: { type: 'text', text: delta },
						},
					],
				} as SessionNotification['update'],
			});
		}
	}

	private async handleToolResult(
		payload: Record<string, unknown> | undefined,
		acpSessionId: string,
		session: AcpSession,
	): Promise<void> {
		const callId =
			typeof payload?.callId === 'string' ? payload.callId : undefined;
		if (!callId) return;

		const name = typeof payload?.name === 'string' ? payload.name : '';
		const result = payload?.result as
			| Record<string, unknown>
			| string
			| undefined;
		const args = payload?.args as Record<string, unknown> | undefined;

		const hasError =
			payload?.error ||
			(typeof result === 'object' &&
				result !== null &&
				'ok' in result &&
				result.ok === false);

		const content = this.buildToolResultContent(name, args, result, session);
		const locations = getToolLocations(name, args, session.cwd);

		await this.client.sessionUpdate({
			sessionId: acpSessionId,
			update: {
				toolCallId: callId,
				sessionUpdate: 'tool_call_update',
				status: hasError ? 'failed' : 'completed',
				...(content.length > 0 ? { content } : {}),
				...(locations.length > 0 ? { locations } : {}),
			} as SessionNotification['update'],
		});

		if (!hasError) {
			await this.notifyEditorOfFileChanges(
				name,
				args,
				result,
				acpSessionId,
				session,
			);
		}
	}

	private buildToolResultContent(
		name: string,
		args: Record<string, unknown> | undefined,
		result: Record<string, unknown> | string | undefined,
		session: AcpSession,
	): ToolCallContent[] {
		if (result === undefined || result === null) return [];

		const isWriteTool = [
			'write',
			'edit',
			'multiedit',
			'copy_into',
			'apply_patch',
		].includes(name);
		if (isWriteTool) {
			return this.buildDiffContent(name, args, result, session);
		}

		if (isShellTool(name)) {
			return this.buildBashContent(result);
		}

		if (name === 'read') {
			return this.buildReadContent(args, result, session);
		}

		let text: string;
		if (typeof result === 'string') {
			text = result;
		} else {
			try {
				text = JSON.stringify(result, null, 2);
			} catch {
				text = String(result);
			}
		}

		if (!text || text.length === 0) return [];

		return [
			{
				type: 'content',
				content: { type: 'text', text: truncate(text, 5000) },
			},
		];
	}

	private buildDiffContent(
		name: string,
		args: Record<string, unknown> | undefined,
		result: Record<string, unknown> | string | undefined,
		_session: AcpSession,
	): ToolCallContent[] {
		const content: ToolCallContent[] = [];

		if (typeof result === 'object' && result !== null) {
			const artifact = result.artifact as Record<string, unknown> | undefined;
			const patch = artifact?.patch as string | undefined;

			if (artifact?.kind === 'file_diff' && patch) {
				const filePath = extractFilePath(name, args, patch);
				if (filePath) {
					const summary = artifact.summary as
						| Record<string, unknown>
						| undefined;
					const _additions = summary?.additions ?? 0;
					const _deletions = summary?.deletions ?? 0;
					content.push({
						type: 'diff',
						path: filePath,
						newText: patch,
						oldText: null,
					} as ToolCallContent);
					return content;
				}
			}

			const ok = result.ok;
			const output = result.output as string | undefined;
			if (ok !== undefined && output) {
				content.push({
					type: 'content',
					content: { type: 'text', text: truncate(output, 3000) },
				});
				return content;
			}
		}

		let text: string;
		if (typeof result === 'string') {
			text = result;
		} else {
			try {
				text = JSON.stringify(result, null, 2);
			} catch {
				text = String(result);
			}
		}
		if (text) {
			content.push({
				type: 'content',
				content: { type: 'text', text: truncate(text, 3000) },
			});
		}

		return content;
	}

	private buildBashContent(
		result: Record<string, unknown> | string | undefined,
	): ToolCallContent[] {
		if (typeof result === 'object' && result !== null) {
			const stdout = result.stdout as string | undefined;
			const stderr = result.stderr as string | undefined;
			const exitCode = result.exitCode as number | undefined;

			const parts: string[] = [];
			if (stdout) parts.push(stdout);
			if (stderr) parts.push(`stderr: ${stderr}`);
			if (exitCode !== undefined && exitCode !== 0) {
				parts.push(`exit code: ${exitCode}`);
			}

			const text = parts.join('\n');
			if (text) {
				return [
					{
						type: 'content',
						content: { type: 'text', text: truncate(text, 5000) },
					},
				];
			}
		}

		return [];
	}

	private buildReadContent(
		args: Record<string, unknown> | undefined,
		result: Record<string, unknown> | string | undefined,
		_session: AcpSession,
	): ToolCallContent[] {
		if (typeof result === 'object' && result !== null) {
			const fileContent = (result as Record<string, unknown>).content as
				| string
				| undefined;
			const filePath = (result as Record<string, unknown>).path as
				| string
				| undefined;
			const _totalLines = (result as Record<string, unknown>).totalLines as
				| number
				| undefined;

			if (fileContent) {
				const _displayPath = filePath || (args?.path as string) || 'file';
				return [
					{
						type: 'content',
						content: {
							type: 'text',
							text: truncate(fileContent, 5000),
						},
					},
				];
			}
		}

		return [];
	}

	private async notifyEditorOfFileChanges(
		name: string,
		args: Record<string, unknown> | undefined,
		result: Record<string, unknown> | string | undefined,
		acpSessionId: string,
		session: AcpSession,
	): Promise<void> {
		if (!this.clientCapabilities?.fs?.writeTextFile) return;

		const isWriteTool = [
			'write',
			'edit',
			'multiedit',
			'copy_into',
			'apply_patch',
		].includes(name);
		if (!isWriteTool) return;

		const filePaths = this.getWrittenFilePaths(name, args, result);

		for (const filePath of filePaths) {
			try {
				const absPath = path.isAbsolute(filePath)
					? filePath
					: path.join(session.cwd, filePath);
				const fileContent = fs.readFileSync(absPath, 'utf-8');
				await this.client.writeTextFile({
					sessionId: acpSessionId,
					path: absPath,
					content: fileContent,
				});
			} catch (err) {
				console.error(
					'[acp] Failed to notify editor of file write:',
					filePath,
					err,
				);
			}
		}
	}

	private getWrittenFilePaths(
		name: string,
		args: Record<string, unknown> | undefined,
		result: Record<string, unknown> | string | undefined,
	): string[] {
		const paths: string[] = [];

		if (args?.path && typeof args.path === 'string') {
			paths.push(args.path);
		} else if (args?.targetPath && typeof args.targetPath === 'string') {
			paths.push(args.targetPath);
		} else if (args?.filePath && typeof args.filePath === 'string') {
			paths.push(args.filePath);
		}

		if (name === 'apply_patch' && typeof args?.patch === 'string') {
			paths.push(...extractPathsFromPatch(args.patch));
		}

		if (typeof result === 'object' && result !== null) {
			const artifact = result.artifact as Record<string, unknown> | undefined;
			const patchStr = artifact?.patch as string | undefined;
			if (patchStr) {
				paths.push(...extractPathsFromPatch(patchStr));
			}
			const changes = result.changes as
				| Array<Record<string, unknown>>
				| undefined;
			if (Array.isArray(changes)) {
				for (const c of changes) {
					if (typeof c.filePath === 'string') paths.push(c.filePath);
				}
			}
		}

		return [...new Set(paths)];
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
			activeTerminals: new Map(),
			mode: row.agent || DEFAULT_MODE,
			provider: row.provider,
			model: row.model,
			mcpServers,
			additionalDirectories: [],
		};
		this.sessions.set(sessionId, session);

		return this.buildSessionState(session);
	}

	private async replaySessionHistory(sessionId: string): Promise<void> {
		const session = this.sessions.get(sessionId);
		if (!session) throw new Error('Session not found');

		const db = await getDb(session.cwd);
		const history = await getSessionHistoryMessages(db, session.ottoSessionId);
		for (const message of history) {
			if (message.role !== 'user' && message.role !== 'assistant') continue;

			const text = extractReplayText(message.parts);
			if (!text) continue;

			await this.client.sessionUpdate({
				sessionId,
				update: {
					sessionUpdate:
						message.role === 'user'
							? 'user_message_chunk'
							: 'agent_message_chunk',
					content: { type: 'text', text },
				},
			});
		}
	}

	private async buildSessionState(
		session: AcpSession,
	): Promise<{
		configOptions: SessionConfigOption[];
		modes: SessionModeState;
		models: SessionModelState | null;
	}> {
		const defaults = await this.loadSessionDefaults(session.cwd);
		session.mode ||= defaults.agent;
		session.provider ||= defaults.provider;
		session.model ||= defaults.model;

		const modelOptions = await this.buildModelOptions(session);
		const currentModel =
			session.provider && session.model
				? toModelId(session.provider, session.model)
				: modelOptions[0]?.value;
		if (
			currentModel &&
			session.provider &&
			session.model &&
			!modelOptions.some((model) => model.value === currentModel)
		) {
			modelOptions.unshift({
				value: currentModel,
				name: `${session.provider}: ${session.model}`,
				description: 'Configured otto default model',
			});
		}
		const modeOptions = ensureModeOption(session.mode);

		const configOptions: SessionConfigOption[] = [
			{
				id: 'agent',
				name: 'Agent',
				type: 'select',
				category: 'mode',
				currentValue: session.mode,
				options: modeOptions.map((mode) => ({
					value: mode.id,
					name: mode.name,
					description: mode.description,
				})),
			},
		];

		if (currentModel && modelOptions.length > 0) {
			configOptions.push({
				id: 'model',
				name: 'Model',
				type: 'select',
				category: 'model',
				currentValue: currentModel,
				options: modelOptions,
			});
		}

		return {
			configOptions,
			modes: {
				currentModeId: session.mode,
				availableModes: modeOptions,
			},
			models:
				currentModel && modelOptions.length > 0
					? {
							currentModelId: currentModel,
							availableModels: modelOptions.map((model) => ({
								modelId: model.value,
								name: model.name,
								description: model.description,
							})),
						}
					: null,
		};
	}

	private async buildModelOptions(
		session: AcpSession,
	): Promise<Array<{ value: string; name: string; description: string }>> {
		try {
			const cfg = await loadConfig(session.cwd);
			const providers = getConfiguredProviderIds(cfg);
			const options: Array<{ value: string; name: string; description: string }> = [];

			for (const provider of providers) {
				if (!(await isProviderAuthorized(cfg, provider))) continue;
				for (const model of getConfiguredProviderModels(cfg, provider)) {
					const modelId = model.id;
					options.push({
						value: toModelId(provider, modelId),
						name: `${provider}: ${model.label ?? modelId}`,
						description: `Use ${modelId} via ${provider}`,
					});
				}
			}

			return options;
		} catch (err) {
			console.error('[acp] Failed to build model list:', err);
			return [];
		}
	}

	private async loadSessionDefaults(cwd: string): Promise<{
		agent: string;
		provider: ProviderId;
		model: string;
	}> {
		try {
			const cfg = await loadConfig(cwd);
			return {
				agent: cfg.defaults.agent || DEFAULT_MODE,
				provider: cfg.defaults.provider,
				model: cfg.defaults.model,
			};
		} catch (err) {
			console.error('[acp] Failed to load defaults:', err);
			return { agent: DEFAULT_MODE, provider: '' as ProviderId, model: '' };
		}
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
	const dirs = 'additionalDirectories' in params ? params.additionalDirectories : [];
	return Array.isArray(dirs) ? dirs.filter((dir) => typeof dir === 'string') : [];
}

function extractReplayText(parts: Array<{ type: string; content: string }>): string {
	const chunks: string[] = [];
	for (const part of parts) {
		if (part.type !== 'text') continue;
		try {
			const parsed = JSON.parse(part.content) as { text?: unknown };
			const text = typeof parsed.text === 'string' ? parsed.text : '';
			if (text) chunks.push(text);
		} catch {
			if (part.content) chunks.push(part.content);
		}
	}
	return chunks.join('\n');
}

function ensureModeOption(modeId: string): typeof MODE_OPTIONS {
	if (MODE_OPTIONS.some((mode) => mode.id === modeId)) return MODE_OPTIONS;
	return [
		...MODE_OPTIONS,
		{
			id: modeId,
			name: modeId,
			description: 'Configured otto default agent',
		},
	];
}

function toModelId(provider: string, model: string): string {
	return `${provider}:${model}`;
}

function parseModelId(modelId: string): { provider: string; model: string } {
	const index = modelId.indexOf(':');
	if (index === -1) return { provider: '', model: modelId };
	return {
		provider: modelId.slice(0, index),
		model: modelId.slice(index + 1),
	};
}

function isShellTool(name: string): boolean {
	return name === 'shell' || name === 'bash';
}

function formatToolTitle(
	name: string,
	args: Record<string, unknown> | undefined,
): string {
	switch (name) {
		case 'read':
			return `Read ${args?.path || 'file'}`;
		case 'edit':
			return `Edit ${args?.path || 'file'}`;
		case 'multiedit':
			return `Multi-edit ${args?.path || 'file'}`;
		case 'copy_into':
			return `Copy into ${args?.targetPath || 'file'}`;
		case 'write':
			return `Write ${args?.path || 'file'}`;
		case 'apply_patch':
			return 'Apply patch';
		case 'shell':
		case 'bash':
			return `Run: ${truncate(String(args?.cmd || 'command'), 60)}`;
		case 'ripgrep':
			return `Search: ${args?.query || ''}`;
		case 'glob':
			return `Find files: ${args?.pattern || ''}`;
		case 'ls':
			return `List ${args?.path || '.'}`;
		case 'tree':
			return `Tree ${args?.path || '.'}`;
		case 'git_status':
			return 'Git status';
		case 'git_diff':
			return 'Git diff';
		case 'web_search':
		case 'websearch':
			return `Search web: ${args?.query || ''}`;
		case 'web_fetch':
			return `Fetch: ${truncate(String(args?.url || ''), 60)}`;
		case 'terminal':
			return `Terminal: ${args?.operation || ''}`;
		case 'update_todos':
			return 'Update plan';
		case 'progress_update':
			return `Progress: ${args?.message || ''}`;
		case 'finish':
			return 'Done';
		default:
			return name;
	}
}

function getToolKind(name: string): ToolKind {
	switch (name) {
		case 'read':
		case 'ls':
		case 'tree':
			return 'read';
		case 'edit':
		case 'multiedit':
		case 'copy_into':
		case 'write':
		case 'apply_patch':
			return 'edit';
		case 'shell':
		case 'bash':
		case 'terminal':
			return 'execute';
		case 'ripgrep':
		case 'glob':
		case 'web_search':
		case 'websearch':
			return 'search';
		case 'web_fetch':
			return 'fetch';
		case 'progress_update':
		case 'update_todos':
			return 'think';
		default:
			return 'other';
	}
}

function getToolLocations(
	name: string,
	args: Record<string, unknown> | undefined,
	cwd: string,
): ToolCallLocation[] {
	if (!args) return [];

	const locations: ToolCallLocation[] = [];

	const filePath =
		(args.path as string) ||
		(args.targetPath as string) ||
		(args.filePath as string) ||
		(args.file as string);

	if (filePath && isFileTool(name)) {
		const absPath = path.isAbsolute(filePath)
			? filePath
			: path.join(cwd, filePath);

		const location: ToolCallLocation = { path: absPath };

		const startLine = args.startLine as number | undefined;
		if (startLine) {
			location.line = startLine;
		}

		locations.push(location);
	}

	if (name === 'apply_patch' && typeof args.patch === 'string') {
		const patchPaths = extractPathsFromPatch(args.patch as string);
		for (const p of patchPaths) {
			const absPath = path.isAbsolute(p) ? p : path.join(cwd, p);
			locations.push({ path: absPath });
		}
	}

	return locations;
}

function isFileTool(name: string): boolean {
	return [
		'read',
		'edit',
		'multiedit',
		'copy_into',
		'write',
		'ls',
		'tree',
	].includes(name);
}

function extractPathsFromPatch(patch: string): string[] {
	const paths: string[] = [];
	const regex = /\*\*\* (?:Update|Add|Delete) File: (.+)/g;
	let match: RegExpExecArray | null = regex.exec(patch);
	while (match !== null) {
		paths.push(match[1].trim());
		match = regex.exec(patch);
	}
	return paths;
}

function extractFilePath(
	_name: string,
	args: Record<string, unknown> | undefined,
	patch?: string,
): string | null {
	if (args?.path) return String(args.path);
	if (args?.filePath) return String(args.filePath);

	if (patch) {
		const match = patch.match(/\*\*\* (?:Update|Add) File: (.+)/);
		if (match) return match[1].trim();

		const diffMatch = patch.match(/^(?:---|\+\+\+) [ab]\/(.+)$/m);
		if (diffMatch) return diffMatch[1].trim();
	}

	return null;
}

function mapPlanStatus(
	status?: string,
): 'pending' | 'in_progress' | 'completed' {
	switch (status) {
		case 'in_progress':
			return 'in_progress';
		case 'completed':
			return 'completed';
		default:
			return 'pending';
	}
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 3)}...`;
}
