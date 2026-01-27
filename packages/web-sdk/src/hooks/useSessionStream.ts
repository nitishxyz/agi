import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SSEClient } from '../lib/sse-client';
import { apiClient } from '../lib/api-client';
import type { Message, MessagePart } from '../types/api';
import { useToolApprovalStore } from '../stores/toolApprovalStore';

export function useSessionStream(sessionId: string | undefined) {
	const queryClient = useQueryClient();
	const clientRef = useRef<SSEClient | null>(null);
	const assistantMessageIdRef = useRef<string | null>(null);
	const lastInvalidationRef = useRef<number>(0);

	const {
		addPendingApproval,
		removePendingApproval,
		updatePendingApproval,
		setPendingApprovals,
	} = useToolApprovalStore();

	useEffect(() => {
		// console.log('[useSessionStream] Hook called with sessionId:', sessionId)
		if (!sessionId) {
			console.log('[useSessionStream] No sessionId, skipping');
			return;
		}

		assistantMessageIdRef.current = null;

		// Fetch pending approvals from server for this session
		apiClient
			.getPendingApprovals(sessionId)
			.then((result) => {
				if (result.ok && result.pending.length > 0) {
					setPendingApprovals(result.pending);
				} else {
					setPendingApprovals([]);
				}
			})
			.catch(() => {
				setPendingApprovals([]);
			});

		const client = new SSEClient();
		clientRef.current = client;

		const url = apiClient.getStreamUrl(sessionId);
		console.log('[useSessionStream] Connecting to stream:', url);
		client.connect(url);

		const resolveAssistantTargetIndex = (messages: Message[]): number => {
			if (assistantMessageIdRef.current) {
				const byId = messages.findIndex(
					(message) => message.id === assistantMessageIdRef.current,
				);
				if (byId !== -1) return byId;
			}
			for (let i = messages.length - 1; i >= 0; i -= 1) {
				const candidate = messages[i];
				if (candidate.role === 'assistant' && candidate.status !== 'complete') {
					return i;
				}
			}
			return -1;
		};

		const extractText = (part: MessagePart): string => {
			if (
				part.contentJson &&
				typeof part.contentJson === 'object' &&
				!Array.isArray(part.contentJson) &&
				'text' in part.contentJson
			) {
				return String((part.contentJson as Record<string, unknown>).text ?? '');
			}
			if (typeof part.content === 'string') {
				try {
					const parsed = JSON.parse(part.content);
					if (parsed && typeof parsed.text === 'string') return parsed.text;
				} catch {}
				return part.content;
			}
			return '';
		};

		const applyReasoningDelta = (
			payload: Record<string, unknown> | undefined,
		) => {
			const messageId =
				typeof payload?.messageId === 'string' ? payload.messageId : null;
			const partId =
				typeof payload?.partId === 'string' ? payload.partId : null;
			const delta = typeof payload?.delta === 'string' ? payload.delta : null;
			if (!messageId || !partId || delta === null) return;
			queryClient.setQueryData<Message[]>(
				['messages', sessionId],
				(oldMessages) => {
					if (!oldMessages) return oldMessages;
					const nextMessages = [...oldMessages];
					const messageIndex = nextMessages.findIndex(
						(message) => message.id === messageId,
					);
					if (messageIndex === -1) return oldMessages;
					const targetMessage = nextMessages[messageIndex];
					const parts = targetMessage.parts ? [...targetMessage.parts] : [];
					let partIndex = parts.findIndex((part) => part.id === partId);
					const stepIndex =
						typeof payload?.stepIndex === 'number' ? payload.stepIndex : null;
					if (partIndex === -1) {
						const newPart: MessagePart = {
							id: partId,
							messageId,
							index: parts.length,
							stepIndex,
							type: 'reasoning',
							content: JSON.stringify({ text: delta }),
							contentJson: { text: delta },
							agent: targetMessage.agent,
							provider: targetMessage.provider,
							model: targetMessage.model,
							startedAt: Date.now(),
							completedAt: null,
							toolName: null,
							toolCallId: null,
							toolDurationMs: null,
						};
						parts.push(newPart);
						partIndex = parts.length - 1;
					} else {
						const existing = parts[partIndex];
						const previous = extractText(existing);
						const nextText = `${previous}${delta}`;
						parts[partIndex] = {
							...existing,
							content: JSON.stringify({ text: nextText }),
							contentJson: { text: nextText },
							stepIndex: stepIndex ?? existing.stepIndex ?? null,
							completedAt: null,
						};
					}
					nextMessages[messageIndex] = { ...targetMessage, parts };
					return nextMessages;
				},
			);
		};

		const applyMessageDelta = (
			payload: Record<string, unknown> | undefined,
		) => {
			const messageId =
				typeof payload?.messageId === 'string' ? payload.messageId : null;
			const partId =
				typeof payload?.partId === 'string' ? payload.partId : null;
			const delta = typeof payload?.delta === 'string' ? payload.delta : null;
			if (!messageId || !partId || delta === null) return;
			queryClient.setQueryData<Message[]>(
				['messages', sessionId],
				(oldMessages) => {
					if (!oldMessages) return oldMessages;
					const nextMessages = [...oldMessages];
					const messageIndex = nextMessages.findIndex(
						(message) => message.id === messageId,
					);
					if (messageIndex === -1) return oldMessages;
					const targetMessage = nextMessages[messageIndex];
					const parts = targetMessage.parts ? [...targetMessage.parts] : [];
					let partIndex = parts.findIndex((part) => part.id === partId);
					const stepIndex =
						typeof payload?.stepIndex === 'number' ? payload.stepIndex : null;
					if (partIndex === -1) {
						const newPart: MessagePart = {
							id: partId,
							messageId,
							index: parts.length,
							stepIndex,
							type: 'text',
							content: JSON.stringify({ text: delta }),
							contentJson: { text: delta },
							agent: targetMessage.agent,
							provider: targetMessage.provider,
							model: targetMessage.model,
							startedAt: Date.now(),
							completedAt: null,
							toolName: null,
							toolCallId: null,
							toolDurationMs: null,
						};
						parts.push(newPart);
						partIndex = parts.length - 1;
					} else {
						const existing = parts[partIndex];
						const previous = extractText(existing);
						const nextText = `${previous}${delta}`;
						parts[partIndex] = {
							...existing,
							content: JSON.stringify({ text: nextText }),
							contentJson: { text: nextText },
							stepIndex: stepIndex ?? existing.stepIndex ?? null,
							completedAt: null,
						};
					}
					nextMessages[messageIndex] = { ...targetMessage, parts };
					return nextMessages;
				},
			);
		};

		const upsertEphemeralToolCall = (
			payload: Record<string, unknown> | undefined,
		) => {
			if (!payload) return;
			const callId = typeof payload.callId === 'string' ? payload.callId : null;
			const name = typeof payload.name === 'string' ? payload.name : null;
			if (!name) return;
			queryClient.setQueryData<Message[]>(
				['messages', sessionId],
				(oldMessages) => {
					if (!oldMessages) return oldMessages;
					const nextMessages = [...oldMessages];
					let targetIndex = resolveAssistantTargetIndex(nextMessages);
					if (typeof payload.messageId === 'string') {
						const explicitIndex = nextMessages.findIndex(
							(message) => message.id === payload.messageId,
						);
						if (explicitIndex !== -1) targetIndex = explicitIndex;
					}
					if (targetIndex === -1) return oldMessages;
					const targetMessage = nextMessages[targetIndex];
					const parts = targetMessage.parts ? [...targetMessage.parts] : [];
					let partIndex = -1;
					if (callId) {
						partIndex = parts.findIndex(
							(part) => part.toolCallId === callId && part.ephemeral,
						);
					}
					// Only fallback to name match if we don't have a callId
					if (partIndex === -1 && !callId) {
						partIndex = parts.findIndex(
							(part) => part.ephemeral && part.toolName === name,
						);
					}
					const args = (payload as { args?: unknown }).args;
					const stepIndex =
						typeof payload.stepIndex === 'number' ? payload.stepIndex : null;
					const contentJsonBase: Record<string, unknown> = { name };
					if (callId) contentJsonBase.callId = callId;
					if (args !== undefined) contentJsonBase.args = args;
					if (partIndex === -1) {
						const newPart: MessagePart = {
							id: callId
								? `ephemeral-tool-call-${callId}`
								: `ephemeral-tool-call-${name}-${Date.now()}`,
							messageId: targetMessage.id,
							index: parts.length,
							stepIndex,
							type: 'tool_call',
							content: JSON.stringify(contentJsonBase),
							contentJson: contentJsonBase,
							agent: targetMessage.agent,
							provider: targetMessage.provider,
							model: targetMessage.model,
							startedAt: Date.now(),
							completedAt: null,
							toolName: name,
							toolCallId: callId,
							toolDurationMs: null,
							ephemeral: true,
						};
						parts.push(newPart);
					} else {
						const existing = parts[partIndex];
						const nextContentJson: Record<string, unknown> = {
							...(typeof existing.contentJson === 'object' &&
							!Array.isArray(existing.contentJson)
								? (existing.contentJson as Record<string, unknown>)
								: {}),
							name,
						};
						if (callId) nextContentJson.callId = callId;
						if (args !== undefined) nextContentJson.args = args;
						parts[partIndex] = {
							...existing,
							content: JSON.stringify(nextContentJson),
							contentJson: nextContentJson,
							stepIndex: stepIndex ?? existing.stepIndex ?? null,
							toolCallId: callId ?? existing.toolCallId,
							toolName: name,
						};
					}
					nextMessages[targetIndex] = { ...targetMessage, parts };
					return nextMessages;
				},
			);
		};

		const removeEphemeralToolCall = (
			payload: Record<string, unknown> | undefined,
		) => {
			const callId =
				typeof payload?.callId === 'string' ? payload.callId : null;
			if (!callId) return;
			queryClient.setQueryData<Message[]>(
				['messages', sessionId],
				(oldMessages) => {
					if (!oldMessages) return oldMessages;
					let changed = false;
					const nextMessages = oldMessages.map((message) => {
						if (!message.parts?.length) return message;
						const filtered = message.parts.filter(
							(part) => !(part.ephemeral && part.toolCallId === callId),
						);
						if (filtered.length === message.parts.length) return message;
						changed = true;
						return { ...message, parts: filtered };
					});
					return changed ? nextMessages : oldMessages;
				},
			);
		};

		const clearEphemeralForMessage = (messageId: string | null) => {
			if (!messageId) return;
			queryClient.setQueryData<Message[]>(
				['messages', sessionId],
				(oldMessages) => {
					if (!oldMessages) return oldMessages;
					const targetIndex = oldMessages.findIndex(
						(message) => message.id === messageId,
					);
					if (targetIndex === -1) return oldMessages;
					const target = oldMessages[targetIndex];
					if (!target.parts?.some((part) => part.ephemeral)) return oldMessages;
					const nextMessages = [...oldMessages];
					nextMessages[targetIndex] = {
						...target,
						parts: target.parts?.filter((part) => !part.ephemeral) ?? [],
					};
					return nextMessages;
				},
			);
		};

		const markMessageCompleted = (
			payload: Record<string, unknown> | undefined,
		) => {
			const id = typeof payload?.id === 'string' ? payload.id : null;
			if (!id) return;
			queryClient.setQueryData<Message[]>(
				['messages', sessionId],
				(oldMessages) => {
					if (!oldMessages) return oldMessages;
					const nextMessages = [...oldMessages];
					const messageIndex = nextMessages.findIndex(
						(message) => message.id === id,
					);
					if (messageIndex === -1) return oldMessages;
					const existing = nextMessages[messageIndex];
					nextMessages[messageIndex] = {
						...existing,
						status: 'complete',
						completedAt: Date.now(),
					};
					return nextMessages;
				},
			);
		};

		// Throttle invalidations to prevent excessive re-renders
		// Only invalidate at most once every 500ms during streaming
		const throttledInvalidate = () => {
			const now = Date.now();
			if (now - lastInvalidationRef.current < 500) {
				return; // Skip if we invalidated less than 500ms ago
			}
			lastInvalidationRef.current = now;
			// console.log('[useSessionStream] Invalidating messages query (throttled)');
			queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
		};

		const invalidatingEvents = new Set([
			'message.completed',
			'tool.result',
			'finish-step',
			'error', // Add error to invalidate and reload from DB
		]);

		const unsubscribe = client.on('*', (event) => {
			// console.log('[useSessionStream] Event received:', event);
			const payload = event.payload as Record<string, unknown> | undefined;

			switch (event.type) {
				case 'message.created': {
					const role = typeof payload?.role === 'string' ? payload.role : null;
					const id = typeof payload?.id === 'string' ? payload.id : null;
					if (role === 'assistant' && id) {
						assistantMessageIdRef.current = id;
					}
					break;
				}
				case 'message.part.delta': {
					applyMessageDelta(payload);
					break;
				}
				case 'reasoning.delta': {
					applyReasoningDelta(payload);
					break;
				}
				case 'message.completed': {
					const id = typeof payload?.id === 'string' ? payload.id : null;
					if (id && assistantMessageIdRef.current === id) {
						assistantMessageIdRef.current = null;
					}
					markMessageCompleted(payload);
					clearEphemeralForMessage(id);
					break;
				}
				case 'tool.delta': {
					const channel =
						typeof payload?.channel === 'string' ? payload.channel : null;
					if (channel === 'input') {
						upsertEphemeralToolCall(payload);
					}
					break;
				}
				case 'tool.call': {
					upsertEphemeralToolCall(payload);
					break;
				}
				case 'tool.result': {
					removeEphemeralToolCall(payload);
					break;
				}
				case 'tool.approval.required': {
					const callId =
						typeof payload?.callId === 'string' ? payload.callId : null;
					const toolName =
						typeof payload?.toolName === 'string' ? payload.toolName : null;
					const messageId =
						typeof payload?.messageId === 'string' ? payload.messageId : null;
					const args = payload?.args;
					if (callId && toolName && messageId) {
						addPendingApproval({
							callId,
							toolName,
							args,
							messageId,
							createdAt: Date.now(),
						});
					}
					break;
				}
				case 'tool.approval.resolved': {
					const callId =
						typeof payload?.callId === 'string' ? payload.callId : null;
					if (callId) {
						removePendingApproval(callId);
					}
					break;
				}
				case 'tool.approval.updated': {
					const callId =
						typeof payload?.callId === 'string' ? payload.callId : null;
					const args = payload?.args;
					if (callId) {
						updatePendingApproval(callId, args);
					}
					break;
				}
				case 'error': {
					removeEphemeralToolCall(payload);
					const messageId =
						typeof payload?.messageId === 'string' ? payload.messageId : null;
					if (messageId) {
						clearEphemeralForMessage(messageId);
					}
					// Error parts are created by the server and will be loaded via query invalidation
					break;
				}
				case 'queue.updated': {
					const queueState = {
						currentMessageId: payload?.currentMessageId as string | null,
						queuedMessages: (payload?.queuedMessages ?? []) as Array<{
							messageId: string;
							position: number;
						}>,
						queueLength: (payload?.queueLength ?? 0) as number,
					};
					queryClient.setQueryData(['queueState', sessionId], queueState);
					break;
				}
				default:
					break;
			}

			if (invalidatingEvents.has(event.type)) {
				// Use throttled invalidation instead of immediate
				throttledInvalidate();
			}
		});

		return () => {
			unsubscribe();
			client.disconnect();
		};
	}, [
		sessionId,
		queryClient,
		addPendingApproval,
		removePendingApproval,
		setPendingApprovals,
		updatePendingApproval,
	]);
}
