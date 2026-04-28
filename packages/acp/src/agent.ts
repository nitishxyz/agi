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
	AvailableCommand,
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
import { listAvailableSlashCommands } from '@ottocode/server/runtime/commands/available';
import { shareSession } from '@ottocode/server/runtime/share/service';
import { discoverAllAgents } from '@ottocode/server/runtime/agent-registry';
import { getDb } from '@ottocode/database';
import {
	getGlobalConfigDir,
	getMCPManager,
	getConfiguredProviderIds,
	getConfiguredProviderModels,
	initializeMCP,
	isProviderAuthorized,
	loadMCPConfig,
	loadConfig,
	type MCPServerConfig,
	type ProviderId,
} from '@ottocode/sdk';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { OttoEvent } from '@ottocode/server/events/types';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { splitCommandArgs } from './commands';
import { acpMcpServersToOttoConfig } from './mcp';
import { parseModelId, toModelId } from './model';
import {
	extractReplayText,
	parseReplayImage,
	parseReplayToolCall,
	parseReplayToolResult,
} from './replay';
import {
	buildToolResultContent,
	formatToolTitle,
	getToolKind,
	getToolLocations,
	getWrittenFilePaths,
	isShellTool,
	isWriteTool,
	mapPlanStatus,
} from './tools';
import { ACP_VERSION, DEFAULT_MODE, type AcpSession } from './types';

const execFileAsync = promisify(execFile);

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
		const state = await this.buildSessionState(session);
		this.queueAvailableCommands(sessionId);

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
		await this.replaySessionHistory(params.sessionId);
		this.queueAvailableCommands(params.sessionId);
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
		const response = await this.resumeExistingSession(
			params.sessionId,
			params.cwd,
			params.mcpServers ?? [],
		);
		this.queueAvailableCommands(params.sessionId);
		return response;
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
			return this.handleShareCommand(params.sessionId, session);
		}
		if (trimmedPrompt === '/stage' || trimmedPrompt.startsWith('/stage ')) {
			return this.handleStageCommand(params.sessionId, session, trimmedPrompt);
		}
		if (trimmedPrompt === '/mcp' || trimmedPrompt.startsWith('/mcp ')) {
			return this.handleMcpCommand(params.sessionId, session, trimmedPrompt);
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

		const content = buildToolResultContent(name, args, result);
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

	private async notifyEditorOfFileChanges(
		name: string,
		args: Record<string, unknown> | undefined,
		result: Record<string, unknown> | string | undefined,
		acpSessionId: string,
		session: AcpSession,
	): Promise<void> {
		if (!this.clientCapabilities?.fs?.writeTextFile) return;
		if (!isWriteTool(name)) return;

		const filePaths = getWrittenFilePaths(name, args, result);

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

			if (message.role === 'user') {
				await this.replayUserMessageParts(sessionId, message.parts);
			} else {
				await this.replayAssistantMessageParts(
					sessionId,
					message.parts,
					session,
				);
			}
		}
	}

	private async replayUserMessageParts(
		sessionId: string,
		parts: Array<{ type: string; content: string }>,
	): Promise<void> {
		for (const part of parts) {
			if (part.type === 'text') {
				const text = extractReplayText([part]);
				if (!text) continue;
				await this.client.sessionUpdate({
					sessionId,
					update: {
						sessionUpdate: 'user_message_chunk',
						content: { type: 'text', text },
					},
				});
			} else if (part.type === 'image') {
				const image = parseReplayImage(part.content);
				if (!image) continue;
				await this.client.sessionUpdate({
					sessionId,
					update: {
						sessionUpdate: 'user_message_chunk',
						content: {
							type: 'image',
							data: image.data,
							mimeType: image.mediaType,
						},
					},
				});
			}
		}
	}

	private async replayAssistantMessageParts(
		sessionId: string,
		parts: Array<{
			type: string;
			content: string;
			toolName?: string | null;
			toolCallId?: string | null;
			compactedAt?: number | null;
		}>,
		session: AcpSession,
	): Promise<void> {
		const toolCalls = new Map<
			string,
			{ name: string; args: Record<string, unknown> | undefined }
		>();

		for (const part of parts) {
			if (part.type === 'text') {
				const text = extractReplayText([part]);
				if (!text) continue;
				await this.client.sessionUpdate({
					sessionId,
					update: {
						sessionUpdate: 'agent_message_chunk',
						content: { type: 'text', text },
					},
				});
				continue;
			}

			if (part.type === 'tool_call') {
				if (part.compactedAt) continue;
				const call = parseReplayToolCall(part);
				if (!call || call.name === 'finish') continue;
				toolCalls.set(call.callId, { name: call.name, args: call.args });
				await this.replayToolCall(sessionId, session, call);
				continue;
			}

			if (part.type === 'tool_result') {
				const result = parseReplayToolResult(part);
				if (!result || result.name === 'finish') continue;
				const call = toolCalls.get(result.callId);
				await this.replayToolResult(sessionId, session, result, call?.args);
			}
		}
	}

	private async replayToolCall(
		sessionId: string,
		session: AcpSession,
		call: {
			name: string;
			callId: string;
			args: Record<string, unknown> | undefined;
		},
	): Promise<void> {
		await this.client.sessionUpdate({
			sessionId,
			update: {
				toolCallId: call.callId,
				sessionUpdate: 'tool_call',
				title: formatToolTitle(call.name, call.args),
				kind: getToolKind(call.name),
				status: 'in_progress',
				rawInput: call.args,
				locations: getToolLocations(call.name, call.args, session.cwd),
			} as SessionNotification['update'],
		});
	}

	private async replayToolResult(
		sessionId: string,
		session: AcpSession,
		result: { name: string; callId: string; result: unknown },
		args: Record<string, unknown> | undefined,
	): Promise<void> {
		const output = result.result as
			| Record<string, unknown>
			| string
			| undefined;
		const hasError =
			typeof output === 'object' &&
			output !== null &&
			'ok' in output &&
			output.ok === false;
		const content = buildToolResultContent(result.name, args, output);

		await this.client.sessionUpdate({
			sessionId,
			update: {
				toolCallId: result.callId,
				sessionUpdate: 'tool_call_update',
				status: hasError ? 'failed' : 'completed',
				rawOutput: result.result,
				...(content.length > 0 ? { content } : {}),
				locations: getToolLocations(result.name, args, session.cwd),
			} as SessionNotification['update'],
		});
	}

	private queueAvailableCommands(sessionId: string): void {
		for (const delayMs of [0, 250]) {
			setTimeout(() => {
				void this.sendAvailableCommands(sessionId).catch((err) => {
					console.error('[acp] Failed to send available commands:', err);
				});
			}, delayMs);
		}
	}

	private async sendAvailableCommands(sessionId: string): Promise<void> {
		const availableCommands: AvailableCommand[] = [
			...listAvailableSlashCommands().map((command) => ({
				name: command.name,
				description: command.description,
				...(command.input ? { input: command.input } : {}),
			})),
			{
				name: 'mcp',
				description: 'List, start, stop, and inspect MCP servers',
				input: { hint: 'list | status | start <name> | stop <name>' },
			},
			{
				name: 'stage',
				description: 'Stage all changes or specific paths',
				input: { hint: '[path ...]' },
			},
		];

		await this.client.sessionUpdate({
			sessionId,
			update: {
				sessionUpdate: 'available_commands_update',
				availableCommands,
			},
		});
	}

	private async handleShareCommand(
		acpSessionId: string,
		session: AcpSession,
	): Promise<PromptResponse> {
		if (!session.ottoSessionId) {
			await this.client.sessionUpdate({
				sessionId: acpSessionId,
				update: {
					sessionUpdate: 'agent_message_chunk',
					content: {
						type: 'text',
						text: 'Cannot share this session yet because it has not been persisted.',
					},
				},
			});
			return { stopReason: 'end_turn' };
		}

		try {
			const result = await shareSession({
				sessionId: session.ottoSessionId,
				projectRoot: session.cwd,
			});
			await this.client.sessionUpdate({
				sessionId: acpSessionId,
				update: {
					sessionUpdate: 'agent_message_chunk',
					content: {
						type: 'text',
						text: `${result.message ?? 'Shared session'}: ${result.url}`,
					},
				},
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await this.client.sessionUpdate({
				sessionId: acpSessionId,
				update: {
					sessionUpdate: 'agent_message_chunk',
					content: {
						type: 'text',
						text: `Failed to share session: ${message}`,
					},
				},
			});
		}

		return { stopReason: 'end_turn' };
	}

	private async handleStageCommand(
		acpSessionId: string,
		session: AcpSession,
		command: string,
	): Promise<PromptResponse> {
		const files = splitCommandArgs(command).slice(1);
		const targets = files.length > 0 ? files : ['.'];

		try {
			await execFileAsync('git', ['add', '--', ...targets], {
				cwd: session.cwd,
			});
			const stagedLabel =
				targets.length === 1 && targets[0] === '.'
					? 'all changes'
					: targets.join(', ');
			await this.sendAgentText(acpSessionId, `Staged ${stagedLabel}.`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await this.sendAgentText(
				acpSessionId,
				`Failed to stage changes: ${message}`,
			);
		}

		return { stopReason: 'end_turn' };
	}

	private async handleMcpCommand(
		acpSessionId: string,
		session: AcpSession,
		command: string,
	): Promise<PromptResponse> {
		const parts = command.split(/\s+/).filter(Boolean);
		const action = parts[1] ?? 'list';
		const name = parts[2];

		try {
			switch (action) {
				case 'list':
				case 'status': {
					const message = await this.formatMcpStatus(session);
					await this.sendAgentText(acpSessionId, message);
					break;
				}

				case 'start': {
					if (!name) {
						await this.sendAgentText(
							acpSessionId,
							'Usage: /mcp start <server-name>',
						);
						break;
					}
					const server = await this.findMcpServer(session, name);
					if (!server) {
						await this.sendAgentText(
							acpSessionId,
							`MCP server "${name}" is not configured.`,
						);
						break;
					}
					const manager = await this.getOrCreateMcpManager(session.cwd);
					await manager.restartServer(server);
					const status = (await manager.getStatusAsync()).find(
						(item) => item.name === server.name,
					);
					const authUrl = manager.getAuthUrl(server.name);
					await this.sendAgentText(
						acpSessionId,
						status?.connected
							? `Started MCP server "${server.name}" with ${status.tools.length} tool${status.tools.length === 1 ? '' : 's'}.`
							: authUrl
								? `MCP server "${server.name}" requires authentication: ${authUrl}`
								: `Started MCP server "${server.name}", but it is not connected yet. Check /mcp status.`,
					);
					break;
				}

				case 'stop': {
					if (!name) {
						await this.sendAgentText(
							acpSessionId,
							'Usage: /mcp stop <server-name>',
						);
						break;
					}
					const manager = getMCPManager();
					if (!manager) {
						await this.sendAgentText(
							acpSessionId,
							'No MCP servers are running.',
						);
						break;
					}
					await manager.stopServer(name);
					await this.sendAgentText(
						acpSessionId,
						`Stopped MCP server "${name}".`,
					);
					break;
				}

				case 'help': {
					await this.sendAgentText(
						acpSessionId,
						'MCP commands:\n- /mcp list\n- /mcp status\n- /mcp start <server-name>\n- /mcp stop <server-name>',
					);
					break;
				}

				default: {
					await this.sendAgentText(
						acpSessionId,
						`Unknown MCP command "${action}". Try /mcp help.`,
					);
				}
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			await this.sendAgentText(acpSessionId, `MCP command failed: ${message}`);
		}

		return { stopReason: 'end_turn' };
	}

	private async formatMcpStatus(session: AcpSession): Promise<string> {
		const configured = await this.getMcpServerConfigs(session);
		const manager = getMCPManager();
		const statuses = manager ? await manager.getStatusAsync() : [];

		if (configured.length === 0 && statuses.length === 0) {
			return 'No MCP servers configured. Add servers in otto config or through your ACP client.';
		}

		const lines = ['MCP servers:'];
		for (const server of configured) {
			const status = statuses.find((item) => item.name === server.name);
			const connected = status?.connected ? 'started' : 'stopped';
			const transport = server.transport ?? 'stdio';
			const toolCount = status?.tools.length ?? 0;
			lines.push(
				`- ${server.name} (${transport}): ${connected}${toolCount > 0 ? `, ${toolCount} tool${toolCount === 1 ? '' : 's'}` : ''}`,
			);
		}

		for (const status of statuses) {
			if (configured.some((server) => server.name === status.name)) continue;
			lines.push(
				`- ${status.name} (${status.transport ?? 'stdio'}): ${status.connected ? 'started' : 'stopped'}, ${status.tools.length} tool${status.tools.length === 1 ? '' : 's'}`,
			);
		}

		lines.push('', 'Use /mcp start <name> or /mcp stop <name>.');
		return lines.join('\n');
	}

	private async findMcpServer(
		session: AcpSession,
		name: string,
	): Promise<MCPServerConfig | undefined> {
		const configs = await this.getMcpServerConfigs(session);
		return configs.find((server) => server.name === name);
	}

	private async getMcpServerConfigs(
		session: AcpSession,
	): Promise<MCPServerConfig[]> {
		const config = await loadMCPConfig(session.cwd, getGlobalConfigDir());
		const servers = new Map<string, MCPServerConfig>();
		for (const server of config.servers) {
			servers.set(server.name, server);
		}
		for (const server of acpMcpServersToOttoConfig(session.mcpServers ?? [])) {
			servers.set(server.name, server);
		}
		return Array.from(servers.values());
	}

	private async getOrCreateMcpManager(cwd: string) {
		let manager = getMCPManager();
		if (!manager) {
			manager = await initializeMCP({ servers: [] }, cwd);
		}
		manager.setProjectRoot(cwd);
		return manager;
	}

	private async sendAgentText(sessionId: string, text: string): Promise<void> {
		await this.client.sessionUpdate({
			sessionId,
			update: {
				sessionUpdate: 'agent_message_chunk',
				content: { type: 'text', text },
			},
		});
	}

	private async buildSessionState(session: AcpSession): Promise<{
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
		const modeOptions = await this.buildModeOptions(session);

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

	private async buildModeOptions(
		session: AcpSession,
	): Promise<SessionModeState['availableModes']> {
		try {
			const cfg = await loadConfig(session.cwd);
			const agents = await discoverAllAgents(cfg.projectRoot);
			return ensureModeOption(session.mode, agents);
		} catch (err) {
			console.error('[acp] Failed to build agent mode list:', err);
			return ensureModeOption(session.mode, [session.mode || DEFAULT_MODE]);
		}
	}

	private async buildModelOptions(
		session: AcpSession,
	): Promise<Array<{ value: string; name: string; description: string }>> {
		try {
			const cfg = await loadConfig(session.cwd);
			const providers = getConfiguredProviderIds(cfg);
			const options: Array<{
				value: string;
				name: string;
				description: string;
			}> = [];

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
	const dirs =
		'additionalDirectories' in params ? params.additionalDirectories : [];
	return Array.isArray(dirs)
		? dirs.filter((dir) => typeof dir === 'string')
		: [];
}

function ensureModeOption(
	modeId: string,
	agentIds: string[],
): SessionModeState['availableModes'] {
	const ids = new Set(agentIds.filter((agentId) => agentId.trim()));
	if (modeId.trim()) ids.add(modeId);
	return Array.from(ids)
		.sort()
		.map((id) => ({
			id,
			name: formatAgentName(id),
			description: `Use the ${id} otto agent`,
		}));
}

function formatAgentName(agentId: string): string {
	return agentId
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
