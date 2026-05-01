import type {
	AgentSideConnection,
	ClientCapabilities,
	SessionNotification,
} from '@agentclientprotocol/sdk';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
	buildToolResultContent,
	formatToolTitle,
	getToolKind,
	getToolLocations,
	getWrittenFilePaths,
	isShellTool,
	isWriteTool,
} from './tools';
import type { AcpSession } from './types';

export async function handleToolCall(
	client: AgentSideConnection,
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
	const update = session.streamedToolCalls.has(callId)
		? {
				toolCallId: callId,
				sessionUpdate: 'tool_call_update',
				title: formatToolTitle(name, args),
				kind,
				status: 'in_progress',
				rawInput: args,
				locations,
			}
		: {
				toolCallId: callId,
				sessionUpdate: 'tool_call',
				title: formatToolTitle(name, args),
				kind,
				status: 'in_progress',
				rawInput: args,
				locations,
			};
	session.streamedToolCalls.add(callId);
	if (isShellTool(name)) {
		session.streamedToolContent.set(callId, '');
	}

	await client.sessionUpdate({
		sessionId: acpSessionId,
		update: update as SessionNotification['update'],
	});
}

export async function handleToolDelta(
	client: AgentSideConnection,
	payload: Record<string, unknown> | undefined,
	acpSessionId: string,
	session: AcpSession,
): Promise<void> {
	const callId =
		typeof payload?.callId === 'string' ? payload.callId : undefined;
	if (!callId) return;

	const name = typeof payload?.name === 'string' ? payload.name : '';
	const channel = typeof payload?.channel === 'string' ? payload.channel : '';
	const delta = payload?.delta;

	if (!session.streamedToolCalls.has(callId)) {
		session.streamedToolCalls.add(callId);
		await client.sessionUpdate({
			sessionId: acpSessionId,
			update: {
				toolCallId: callId,
				sessionUpdate: 'tool_call',
				title: formatToolTitle(name, undefined),
				kind: getToolKind(name),
				status: channel === 'input' ? 'pending' : 'in_progress',
			} as SessionNotification['update'],
		});
	}

	if (channel === 'input') return;

	if (
		isShellTool(name) &&
		channel === 'terminal' &&
		typeof delta === 'string'
	) {
		await client.sessionUpdate({
			sessionId: acpSessionId,
			update: {
				toolCallId: callId,
				sessionUpdate: 'tool_call_update',
				content: [{ type: 'terminal', terminalId: delta }],
			} as SessionNotification['update'],
		});
		return;
	}

	if (isShellTool(name) && typeof delta === 'string' && delta) {
		const text = truncate(
			`${session.streamedToolContent.get(callId) ?? ''}${delta}`,
			20000,
		);
		session.streamedToolContent.set(callId, text);
		await client.sessionUpdate({
			sessionId: acpSessionId,
			update: {
				toolCallId: callId,
				sessionUpdate: 'tool_call_update',
				content: [
					{
						type: 'content',
						content: { type: 'text', text },
					},
				],
			} as SessionNotification['update'],
		});
	}
}

export async function handleToolResult(
	client: AgentSideConnection,
	clientCapabilities: ClientCapabilities | undefined,
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

	const content = buildToolResultContent(name, args, result, session.cwd);
	const locations = getToolLocations(name, args, session.cwd, result);
	session.streamedToolCalls.delete(callId);
	session.streamedToolContent.delete(callId);

	await client.sessionUpdate({
		sessionId: acpSessionId,
		update: {
			toolCallId: callId,
			sessionUpdate: 'tool_call_update',
			status: hasError ? 'failed' : 'completed',
			...(typeof result === 'object' && result !== null
				? { rawOutput: result }
				: {}),
			...(content.length > 0 ? { content } : {}),
			...(locations.length > 0 ? { locations } : {}),
		} as SessionNotification['update'],
	});

	if (!hasError) {
		await notifyEditorOfFileChanges(
			client,
			clientCapabilities,
			name,
			args,
			result,
			acpSessionId,
			session,
		);
	}
}

function truncate(text: string, max: number): string {
	if (text.length <= max) return text;
	return `…${text.slice(text.length - max + 1)}`;
}

async function notifyEditorOfFileChanges(
	client: AgentSideConnection,
	clientCapabilities: ClientCapabilities | undefined,
	name: string,
	args: Record<string, unknown> | undefined,
	result: Record<string, unknown> | string | undefined,
	acpSessionId: string,
	session: AcpSession,
): Promise<void> {
	if (!clientCapabilities?.fs?.writeTextFile) return;
	if (!isWriteTool(name)) return;

	const filePaths = getWrittenFilePaths(name, args, result);

	for (const filePath of filePaths) {
		try {
			const absPath = path.isAbsolute(filePath)
				? filePath
				: path.join(session.cwd, filePath);
			const fileContent = fs.readFileSync(absPath, 'utf-8');
			await client.writeTextFile({
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
