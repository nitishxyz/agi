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
} from "@agentclientprotocol/sdk";
import type {
	ToolKind,
	ToolCallLocation,
	ToolCallContent,
} from "@agentclientprotocol/sdk/schema/types.gen";
import { handleAskRequest } from "@ottocode/server/runtime/ask/service";
import { subscribe, publish } from "@ottocode/server/events/bus";
import {
	abortMessage,
	getRunnerState,
} from "@ottocode/server/runtime/agent/runner";
import { loadConfig } from "@ottocode/sdk";
import { getDb } from "@ottocode/database";
import { randomUUID } from "node:crypto";
import type { OttoEvent } from "@ottocode/server/events/types";
import * as path from "node:path";

type AcpSession = {
	sessionId: string;
	ottoSessionId: string;
	cwd: string;
	cancelled: boolean;
	assistantMessageId: string | null;
	resolvePrompt: ((response: PromptResponse) => void) | null;
	unsubscribe: (() => void) | null;
	activeTerminals: Map<string, { terminalId: string; release: () => Promise<void> }>;
};

export class OttoAcpAgent implements Agent {
	private client: AgentSideConnection;
	private sessions = new Map<string, AcpSession>();
	private clientCapabilities?: ClientCapabilities;

	constructor(client: AgentSideConnection) {
		this.client = client;
	}

	async initialize(
		request: InitializeRequest,
	): Promise<InitializeResponse> {
		this.clientCapabilities = request.clientCapabilities;

		return {
			protocolVersion: 1,
			agentCapabilities: {
				promptCapabilities: {
					image: false,
					embeddedContext: true,
				},
			},
			agentInfo: {
				name: "otto",
				title: "Otto",
				version: "0.1.196",
			},
			authMethods: [],
		};
	}

	async authenticate(
		_params: AuthenticateRequest,
	): Promise<AuthenticateResponse | void> {}

	async newSession(
		params: NewSessionRequest,
	): Promise<NewSessionResponse> {
		const cwd = params.cwd || process.cwd();

		try {
			await getDb(cwd);
		} catch (err) {
			console.error("[acp] Failed to initialize database:", err);
		}

		const sessionId = randomUUID();
		const session: AcpSession = {
			sessionId,
			ottoSessionId: "",
			cwd,
			cancelled: false,
			assistantMessageId: null,
			resolvePrompt: null,
			unsubscribe: null,
			activeTerminals: new Map(),
		};

		this.sessions.set(sessionId, session);

		return {
			sessionId,
		};
	}

	async prompt(params: PromptRequest): Promise<PromptResponse> {
		const session = this.sessions.get(params.sessionId);
		if (!session) {
			throw new Error("Session not found");
		}

		session.cancelled = false;

		const textParts: string[] = [];
		for (const chunk of params.prompt) {
			if (chunk.type === "text") {
				textParts.push(chunk.text);
			} else if (chunk.type === "resource" && "text" in chunk.resource) {
				textParts.push(
					`<context uri="${chunk.resource.uri}">\n${chunk.resource.text}\n</context>`,
				);
			} else if (chunk.type === "resource_link") {
				textParts.push(`@${chunk.uri}`);
			}
		}
		const prompt = textParts.join("\n");

		let response: Awaited<ReturnType<typeof handleAskRequest>>;
		try {
			response = await handleAskRequest({
				projectRoot: session.cwd,
				prompt,
				sessionId: session.ottoSessionId || undefined,
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error("[acp] handleAskRequest failed:", msg);
			await this.client.sessionUpdate({
				sessionId: params.sessionId,
				update: {
					sessionUpdate: "agent_message_chunk",
					content: { type: "text", text: `Error: ${msg}\n\nMake sure you have a provider configured. Run \`otto auth\` to set up API keys.` },
				},
			});
			return { stopReason: "end_turn" };
		}

		session.ottoSessionId = response.sessionId;
		session.assistantMessageId = response.assistantMessageId;

		const unsub = subscribe(
			response.sessionId,
			(event: OttoEvent) => {
				void this.handleOttoEvent(event, params.sessionId);
			},
		);
		session.unsubscribe = unsub;

		return new Promise<PromptResponse>((resolve) => {
			session.resolvePrompt = resolve;

			const checkInterval = setInterval(() => {
				if (session.cancelled) {
					clearInterval(checkInterval);
					unsub();
					session.unsubscribe = null;
					resolve({ stopReason: "cancelled" });
					return;
				}

				if (!session.assistantMessageId) return;

				const state = getRunnerState();
				const isRunning = state.running.has(session.ottoSessionId);
				const hasQueued = state.queued[session.ottoSessionId]?.length > 0;

				if (!isRunning && !hasQueued && session.assistantMessageId) {
					clearInterval(checkInterval);
					unsub();
					session.unsubscribe = null;
					resolve({ stopReason: "end_turn" });
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
				case "message.part.delta": {
					const delta =
						typeof payload?.delta === "string" ? payload.delta : "";
					if (
						delta &&
						payload?.messageId === session.assistantMessageId
					) {
						await this.client.sessionUpdate({
							sessionId: acpSessionId,
							update: {
								sessionUpdate: "agent_message_chunk",
								content: { type: "text", text: delta },
							},
						});
					}
					break;
				}

				case "reasoning.delta": {
					const delta =
						typeof payload?.delta === "string" ? payload.delta : "";
					if (delta) {
						await this.client.sessionUpdate({
							sessionId: acpSessionId,
							update: {
								sessionUpdate: "agent_thought_chunk",
								content: { type: "text", text: delta },
							},
						});
					}
					break;
				}

				case "tool.call": {
					await this.handleToolCall(payload, acpSessionId, session);
					break;
				}

				case "tool.delta": {
					await this.handleToolDelta(payload, acpSessionId, session);
					break;
				}

				case "tool.result": {
					await this.handleToolResult(payload, acpSessionId, session);
					break;
				}

				case "plan.updated": {
					const items = payload?.items as
						| Array<{ step: string; status?: string }>
						| undefined;
					if (items) {
						await this.client.sessionUpdate({
							sessionId: acpSessionId,
							update: {
								sessionUpdate: "plan",
								entries: items.map((item) => ({
									content: item.step,
									status: mapPlanStatus(item.status),
								})),
							},
						});
					}
					break;
				}

				case "tool.approval.required": {
					const callId =
						typeof payload?.callId === "string"
							? payload.callId
							: undefined;
					const toolName =
						typeof payload?.toolName === "string"
							? payload.toolName
							: "tool";

					if (!callId) break;

					const response = await this.client.requestPermission({
						options: [
							{
								kind: "allow_once",
								name: "Allow",
								optionId: "allow",
							},
							{
								kind: "reject_once",
								name: "Reject",
								optionId: "reject",
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
						response.outcome?.outcome === "selected" &&
						response.outcome.optionId === "allow";

					publish({
						type: "tool.approval.resolved",
						sessionId: session.ottoSessionId,
						payload: { callId, approved },
					});
					return;
				}

				case "message.completed": {
					if (
						payload?.id === session.assistantMessageId &&
						session.resolvePrompt
					) {
						const resolve = session.resolvePrompt;
						session.resolvePrompt = null;
						session.unsubscribe?.();
						session.unsubscribe = null;
						resolve({ stopReason: "end_turn" });
					}
					return;
				}

				case "error": {
					const errorText =
						typeof payload?.error === "string"
							? payload.error
							: typeof payload?.message === "string"
								? payload.message
								: "Unknown error";

					await this.client.sessionUpdate({
						sessionId: acpSessionId,
						update: {
							sessionUpdate: "agent_message_chunk",
							content: { type: "text", text: `\n\nError: ${errorText}\n` },
						},
					});
					break;
				}

				default:
					return;
			}
		} catch (err) {
			console.error("[acp] Error handling event:", event.type, err);
		}
	}

	private async handleToolCall(
		payload: Record<string, unknown> | undefined,
		acpSessionId: string,
		session: AcpSession,
	): Promise<void> {
		const name =
			typeof payload?.name === "string" ? payload.name : "tool";
		const callId =
			typeof payload?.callId === "string"
				? payload.callId
				: randomUUID();
		const args = payload?.args as Record<string, unknown> | undefined;

		const kind = getToolKind(name);
		const locations = getToolLocations(name, args, session.cwd);

		await this.client.sessionUpdate({
			sessionId: acpSessionId,
			update: {
				toolCallId: callId,
				sessionUpdate: "tool_call",
				title: formatToolTitle(name, args),
				kind,
				status: "in_progress",
				rawInput: args,
				locations,
			} as SessionNotification["update"],
		});
	}

	private async handleToolDelta(
		payload: Record<string, unknown> | undefined,
		acpSessionId: string,
		session: AcpSession,
	): Promise<void> {
		const callId = typeof payload?.callId === "string" ? payload.callId : undefined;
		if (!callId) return;

		const name = typeof payload?.name === "string" ? payload.name : "";
		const delta = payload?.delta;

		if (name === "bash" && typeof delta === "string" && delta) {
			await this.client.sessionUpdate({
				sessionId: acpSessionId,
				update: {
					toolCallId: callId,
					sessionUpdate: "tool_call_update",
					content: [
						{
							type: "content",
							content: { type: "text", text: delta },
						},
					],
				} as SessionNotification["update"],
			});
		}
	}

	private async handleToolResult(
		payload: Record<string, unknown> | undefined,
		acpSessionId: string,
		session: AcpSession,
	): Promise<void> {
		const callId =
			typeof payload?.callId === "string"
				? payload.callId
				: undefined;
		if (!callId) return;

		const name =
			typeof payload?.name === "string" ? payload.name : "";
		const result = payload?.result as Record<string, unknown> | string | undefined;
		const args = payload?.args as Record<string, unknown> | undefined;

		const hasError =
			payload?.error ||
			(typeof result === "object" &&
				result !== null &&
				"ok" in result &&
				result.ok === false);

		const content = this.buildToolResultContent(name, args, result, session);
		const locations = getToolLocations(name, args, session.cwd);

		await this.client.sessionUpdate({
			sessionId: acpSessionId,
			update: {
				toolCallId: callId,
				sessionUpdate: "tool_call_update",
				status: hasError ? "failed" : "completed",
				...(content.length > 0 ? { content } : {}),
				...(locations.length > 0 ? { locations } : {}),
			} as SessionNotification["update"],
		});
	}

	private buildToolResultContent(
		name: string,
		args: Record<string, unknown> | undefined,
		result: Record<string, unknown> | string | undefined,
		session: AcpSession,
	): ToolCallContent[] {
		if (result === undefined || result === null) return [];

		const isWriteTool = ["write", "edit", "multiedit", "apply_patch"].includes(name);
		if (isWriteTool) {
			return this.buildDiffContent(name, args, result, session);
		}

		if (name === "bash") {
			return this.buildBashContent(result);
		}

		if (name === "read") {
			return this.buildReadContent(args, result, session);
		}

		let text: string;
		if (typeof result === "string") {
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
				type: "content",
				content: { type: "text", text: truncate(text, 5000) },
			},
		];
	}

	private buildDiffContent(
		name: string,
		args: Record<string, unknown> | undefined,
		result: Record<string, unknown> | string | undefined,
		session: AcpSession,
	): ToolCallContent[] {
		const content: ToolCallContent[] = [];

		if (typeof result === "object" && result !== null) {
			const artifact = result.artifact as Record<string, unknown> | undefined;
			const patch = artifact?.patch as string | undefined;

			if (artifact?.kind === "file_diff" && patch) {
				const filePath = extractFilePath(name, args, patch);
				if (filePath) {
					const summary = artifact.summary as Record<string, unknown> | undefined;
					const additions = summary?.additions ?? 0;
					const deletions = summary?.deletions ?? 0;
					content.push({
						type: "diff",
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
					type: "content",
					content: { type: "text", text: truncate(output, 3000) },
				});
				return content;
			}
		}

		let text: string;
		if (typeof result === "string") {
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
				type: "content",
				content: { type: "text", text: truncate(text, 3000) },
			});
		}

		return content;
	}

	private buildBashContent(
		result: Record<string, unknown> | string | undefined,
	): ToolCallContent[] {
		if (typeof result === "object" && result !== null) {
			const stdout = result.stdout as string | undefined;
			const stderr = result.stderr as string | undefined;
			const exitCode = result.exitCode as number | undefined;

			const parts: string[] = [];
			if (stdout) parts.push(stdout);
			if (stderr) parts.push(`stderr: ${stderr}`);
			if (exitCode !== undefined && exitCode !== 0) {
				parts.push(`exit code: ${exitCode}`);
			}

			const text = parts.join("\n");
			if (text) {
				return [
					{
						type: "content",
						content: { type: "text", text: truncate(text, 5000) },
					},
				];
			}
		}

		return [];
	}

	private buildReadContent(
		args: Record<string, unknown> | undefined,
		result: Record<string, unknown> | string | undefined,
		session: AcpSession,
	): ToolCallContent[] {
		if (typeof result === "object" && result !== null) {
			const fileContent = (result as Record<string, unknown>).content as string | undefined;
			const filePath = (result as Record<string, unknown>).path as string | undefined;
			const totalLines = (result as Record<string, unknown>).totalLines as number | undefined;

			if (fileContent) {
				const displayPath = filePath || (args?.path as string) || "file";
				return [
					{
						type: "content",
						content: {
							type: "text",
							text: truncate(fileContent, 5000),
						},
					},
				];
			}
		}

		return [];
	}
}

function formatToolTitle(
	name: string,
	args: Record<string, unknown> | undefined,
): string {
	switch (name) {
		case "read":
			return `Read ${args?.path || "file"}`;
		case "write":
			return `Write ${args?.path || "file"}`;
		case "edit":
			return `Edit ${args?.filePath || "file"}`;
		case "multiedit":
			return `Multi-edit ${args?.filePath || "file"}`;
		case "apply_patch":
			return "Apply patch";
		case "bash":
			return `Run: ${truncate(String(args?.cmd || "command"), 60)}`;
		case "ripgrep":
			return `Search: ${args?.query || ""}`;
		case "glob":
			return `Find files: ${args?.pattern || ""}`;
		case "grep":
			return `Grep: ${args?.query || ""}`;
		case "ls":
			return `List ${args?.path || "."}`;
		case "tree":
			return `Tree ${args?.path || "."}`;
		case "git_status":
			return "Git status";
		case "git_diff":
			return "Git diff";
		case "web_search":
		case "websearch":
			return `Search web: ${args?.query || ""}`;
		case "web_fetch":
			return `Fetch: ${truncate(String(args?.url || ""), 60)}`;
		case "terminal":
			return `Terminal: ${args?.operation || ""}`;
		case "update_todos":
			return "Update plan";
		case "progress_update":
			return `Progress: ${args?.message || ""}`;
		case "finish":
			return "Done";
		default:
			return name;
	}
}

function getToolKind(name: string): ToolKind {
	switch (name) {
		case "read":
		case "ls":
		case "tree":
			return "read";
		case "write":
		case "edit":
		case "multiedit":
		case "apply_patch":
			return "edit";
		case "bash":
		case "terminal":
			return "execute";
		case "ripgrep":
		case "grep":
		case "glob":
		case "web_search":
		case "websearch":
			return "search";
		case "web_fetch":
			return "fetch";
		case "progress_update":
		case "update_todos":
			return "think";
		default:
			return "other";
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

	if (name === "apply_patch" && typeof args.patch === "string") {
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
		"read", "write", "edit", "multiedit",
		"ls", "tree",
	].includes(name);
}

function extractPathsFromPatch(patch: string): string[] {
	const paths: string[] = [];
	const regex = /\*\*\* (?:Update|Add|Delete) File: (.+)/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(patch)) !== null) {
		paths.push(match[1].trim());
	}
	return paths;
}

function extractFilePath(
	name: string,
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
): "pending" | "in_progress" | "completed" | "cancelled" {
	switch (status) {
		case "in_progress":
			return "in_progress";
		case "completed":
			return "completed";
		case "cancelled":
			return "cancelled";
		default:
			return "pending";
	}
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max - 3)}...`;
}
