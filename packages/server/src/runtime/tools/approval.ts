import { publish } from '../../events/bus.ts';
import { debugLog } from '../debug/index.ts';

export type ToolApprovalMode = 'auto' | 'dangerous' | 'all';

export const DANGEROUS_TOOLS = new Set([
	'bash',
	'write',
	'apply_patch',
	'terminal',
	'edit',
	'git_commit',
	'git_push',
]);

export const SAFE_TOOLS = new Set([
	'finish',
	'progress_update',
	'update_todos',
]);

export interface PendingApproval {
	callId: string;
	toolName: string;
	args: unknown;
	sessionId: string;
	messageId: string;
	resolve: (approved: boolean) => void;
	createdAt: number;
}

const pendingApprovals = new Map<string, PendingApproval>();

export function requiresApproval(
	toolName: string,
	mode: ToolApprovalMode,
): boolean {
	if (SAFE_TOOLS.has(toolName)) return false;
	if (mode === 'auto') return false;
	if (mode === 'all') return true;
	if (mode === 'dangerous') return DANGEROUS_TOOLS.has(toolName);
	return false;
}

export async function requestApproval(
	sessionId: string,
	messageId: string,
	callId: string,
	toolName: string,
	args: unknown,
	timeoutMs = 120000,
): Promise<boolean> {
	debugLog('[approval] requestApproval called', {
		sessionId,
		messageId,
		callId,
		toolName,
	});
	return new Promise((resolve) => {
		const approval: PendingApproval = {
			callId,
			toolName,
			args,
			sessionId,
			messageId,
			resolve,
			createdAt: Date.now(),
		};

		pendingApprovals.set(callId, approval);
		debugLog(
			'[approval] Added to pendingApprovals, count:',
			pendingApprovals.size,
		);

		publish({
			type: 'tool.approval.required',
			sessionId,
			payload: {
				callId,
				toolName,
				args,
				messageId,
			},
		});

		setTimeout(() => {
			if (pendingApprovals.has(callId)) {
				pendingApprovals.delete(callId);
				resolve(false);
				publish({
					type: 'tool.approval.resolved',
					sessionId,
					payload: {
						callId,
						toolName,
						approved: false,
						reason: 'timeout',
					},
				});
			}
		}, timeoutMs);
	});
}

export function resolveApproval(
	callId: string,
	approved: boolean,
): { ok: boolean; error?: string } {
	debugLog('[approval] resolveApproval called', {
		callId,
		approved,
		pendingCount: pendingApprovals.size,
		pendingIds: [...pendingApprovals.keys()],
	});
	const approval = pendingApprovals.get(callId);
	if (!approval) {
		debugLog('[approval] No pending approval found for callId:', callId);
		return { ok: false, error: 'No pending approval found for this callId' };
	}

	pendingApprovals.delete(callId);
	approval.resolve(approved);

	publish({
		type: 'tool.approval.resolved',
		sessionId: approval.sessionId,
		payload: {
			callId,
			toolName: approval.toolName,
			approved,
			reason: approved ? 'user_approved' : 'user_rejected',
		},
	});

	return { ok: true };
}

export function getPendingApproval(
	callId: string,
): PendingApproval | undefined {
	return pendingApprovals.get(callId);
}

export function updateApprovalArgs(callId: string, args: unknown): boolean {
	const approval = pendingApprovals.get(callId);
	if (!approval) return false;

	approval.args = args;

	publish({
		type: 'tool.approval.updated',
		sessionId: approval.sessionId,
		payload: {
			callId,
			toolName: approval.toolName,
			args,
			messageId: approval.messageId,
		},
	});

	return true;
}

export function getPendingApprovalsForSession(
	sessionId: string,
): PendingApproval[] {
	return Array.from(pendingApprovals.values()).filter(
		(a) => a.sessionId === sessionId,
	);
}

export function clearPendingApprovalsForSession(sessionId: string): void {
	for (const [callId, approval] of pendingApprovals) {
		if (approval.sessionId === sessionId) {
			approval.resolve(false);
			pendingApprovals.delete(callId);
		}
	}
}
