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

	await client.sessionUpdate({
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

export async function handleToolDelta(
	client: AgentSideConnection,
	payload: Record<string, unknown> | undefined,
	acpSessionId: string,
): Promise<void> {
	const callId =
		typeof payload?.callId === 'string' ? payload.callId : undefined;
	if (!callId) return;

	const name = typeof payload?.name === 'string' ? payload.name : '';
	const delta = payload?.delta;

	if (isShellTool(name) && typeof delta === 'string' && delta) {
		await client.sessionUpdate({
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
	const locations = getToolLocations(name, args, session.cwd);

	await client.sessionUpdate({
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
