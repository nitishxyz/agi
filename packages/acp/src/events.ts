import type {
	AgentSideConnection,
	ClientCapabilities,
} from '@agentclientprotocol/sdk';
import { resolveApproval } from '@ottocode/server/runtime/tools/approval';
import type { OttoEvent } from '@ottocode/server/events/types';
import { getToolLocations, mapPlanStatus } from './tools';
import {
	handleToolCall,
	handleToolDelta,
	handleToolResult,
} from './tool-events';
import type { AcpSession } from './types';

export async function handleOttoEvent(
	client: AgentSideConnection,
	clientCapabilities: ClientCapabilities | undefined,
	event: OttoEvent,
	acpSessionId: string,
	session: AcpSession,
): Promise<void> {
	if (session.cancelled) return;

	const payload = event.payload as Record<string, unknown> | undefined;

	try {
		switch (event.type) {
			case 'message.part.delta': {
				const delta = typeof payload?.delta === 'string' ? payload.delta : '';
				if (delta && payload?.messageId === session.assistantMessageId) {
					await client.sessionUpdate({
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
					await client.sessionUpdate({
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
				await handleToolCall(client, payload, acpSessionId, session);
				break;
			}

			case 'tool.delta': {
				await handleToolDelta(client, payload, acpSessionId);
				break;
			}

			case 'tool.result': {
				await handleToolResult(
					client,
					clientCapabilities,
					payload,
					acpSessionId,
					session,
				);
				break;
			}

			case 'plan.updated': {
				const items = payload?.items as
					| Array<{ step: string; status?: string }>
					| undefined;
				if (items) {
					await client.sessionUpdate({
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
				const args = payload?.args as Record<string, unknown> | undefined;

				if (!callId) break;

				const response = await client.requestPermission({
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
						rawInput: args,
						locations: getToolLocations(toolName, args, session.cwd),
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

				await client.sessionUpdate({
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
