import {
	resolveApproval as apiResolveApproval,
	getPendingApprovals as apiGetPendingApprovals,
} from '@ottocode/api';

export const approvalMixin = {
	async approveToolCall(
		sessionId: string,
		callId: string,
		approved: boolean,
	): Promise<{ ok: boolean; callId: string; approved: boolean }> {
		const response = await apiResolveApproval({
			// biome-ignore lint/suspicious/noExplicitAny: API path type mismatch
			path: { sessionId } as any,
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch
			body: { callId, approved, sessionId } as any,
		});
		if (response.error) throw new Error('Failed to send tool approval');
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async getPendingApprovals(sessionId: string): Promise<{
		ok: boolean;
		pending: Array<{
			callId: string;
			toolName: string;
			args: unknown;
			messageId: string;
			createdAt: number;
		}>;
	}> {
		// biome-ignore lint/suspicious/noExplicitAny: API path type mismatch
		const response = await apiGetPendingApprovals({
			path: { sessionId } as any,
		});
		if (response.error) return { ok: false, pending: [] };
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},
};
