import { create } from 'zustand';

export interface PendingToolApproval {
	callId: string;
	toolName: string;
	args: unknown;
	messageId: string;
	createdAt: number;
}

interface ToolApprovalState {
	pendingApprovals: PendingToolApproval[];
	addPendingApproval: (approval: PendingToolApproval) => void;
	removePendingApproval: (callId: string) => void;
	clearPendingApprovals: () => void;
	setPendingApprovals: (approvals: PendingToolApproval[]) => void;
}

export const useToolApprovalStore = create<ToolApprovalState>((set) => ({
	pendingApprovals: [],

	addPendingApproval: (approval) =>
		set((state) => ({
			pendingApprovals: [...state.pendingApprovals, approval],
		})),

	removePendingApproval: (callId) =>
		set((state) => ({
			pendingApprovals: state.pendingApprovals.filter((a) => a.callId !== callId),
		})),

	clearPendingApprovals: () =>
		set({ pendingApprovals: [] }),

	setPendingApprovals: (approvals) =>
		set({ pendingApprovals: approvals }),
}));
