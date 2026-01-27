import { useEffect, useCallback } from 'react';
import { useToolApprovalStore } from '../stores/toolApprovalStore';
import { apiClient } from '../lib/api-client';

/**
 * Hook for handling keyboard shortcuts for tool approval.
 * Only responds to shortcuts when there are pending approvals for the given session.
 *
 * Shortcuts:
 * - Y: Approve first pending
 * - N or Escape: Reject first pending
 * - A: Approve all pending
 */
export function useToolApprovalShortcuts(sessionId: string | undefined) {
	const { pendingApprovals, removePendingApproval } = useToolApprovalStore();

	// Filter approvals for this session
	// Since approvals are tied to messages, and messages to sessions,
	// we need to check that the pending approval belongs to this session's messages
	const sessionPendingApprovals = pendingApprovals;

	const handleApprove = useCallback(
		async (callId: string) => {
			if (!sessionId) return;
			try {
				await apiClient.approveToolCall(sessionId, callId, true);
				removePendingApproval(callId);
			} catch (error) {
				console.error('Failed to approve tool call:', error);
			}
		},
		[sessionId, removePendingApproval],
	);

	const handleReject = useCallback(
		async (callId: string) => {
			if (!sessionId) return;
			try {
				await apiClient.approveToolCall(sessionId, callId, false);
				removePendingApproval(callId);
			} catch (error) {
				console.error('Failed to reject tool call:', error);
			}
		},
		[sessionId, removePendingApproval],
	);

	const handleApproveAll = useCallback(async () => {
		if (!sessionId) return;
		try {
			await Promise.all(
				sessionPendingApprovals.map((a) =>
					apiClient.approveToolCall(sessionId, a.callId, true),
				),
			);
			for (const a of sessionPendingApprovals) {
				removePendingApproval(a.callId);
			}
		} catch (error) {
			console.error('Failed to approve all tool calls:', error);
		}
	}, [sessionId, sessionPendingApprovals, removePendingApproval]);

	useEffect(() => {
		if (!sessionId || sessionPendingApprovals.length === 0) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't trigger if user is typing in an input/textarea
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement ||
				(e.target as HTMLElement)?.isContentEditable
			) {
				return;
			}

			const firstPending = sessionPendingApprovals[0];

			if (e.key === 'y' || e.key === 'Y') {
				e.preventDefault();
				handleApprove(firstPending.callId);
			} else if (e.key === 'n' || e.key === 'N' || e.key === 'Escape') {
				e.preventDefault();
				handleReject(firstPending.callId);
			} else if (e.key === 'a' || e.key === 'A') {
				e.preventDefault();
				handleApproveAll();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [
		sessionId,
		sessionPendingApprovals,
		handleApprove,
		handleReject,
		handleApproveAll,
	]);
}
