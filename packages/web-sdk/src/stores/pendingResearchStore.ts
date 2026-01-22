import { create } from 'zustand';

export interface PendingResearchContext {
	id: string;
	sessionId: string;
	label: string;
	content: string;
}

interface PendingResearchState {
	pendingContexts: Map<string, PendingResearchContext[]>;
	addContext: (
		parentSessionId: string,
		context: PendingResearchContext,
	) => void;
	removeContext: (parentSessionId: string, contextId: string) => void;
	getContexts: (parentSessionId: string) => PendingResearchContext[];
	clearContexts: (parentSessionId: string) => void;
	consumeContexts: (parentSessionId: string) => PendingResearchContext[];
}

export const usePendingResearchStore = create<PendingResearchState>(
	(set, get) => ({
		pendingContexts: new Map(),

		addContext: (parentSessionId, context) => {
			set((state) => {
				const newMap = new Map(state.pendingContexts);
				const existing = newMap.get(parentSessionId) || [];
				if (!existing.some((c) => c.id === context.id)) {
					newMap.set(parentSessionId, [...existing, context]);
				}
				return { pendingContexts: newMap };
			});
		},

		removeContext: (parentSessionId, contextId) => {
			set((state) => {
				const newMap = new Map(state.pendingContexts);
				const existing = newMap.get(parentSessionId) || [];
				newMap.set(
					parentSessionId,
					existing.filter((c) => c.id !== contextId),
				);
				return { pendingContexts: newMap };
			});
		},

		getContexts: (parentSessionId) => {
			return get().pendingContexts.get(parentSessionId) || [];
		},

		clearContexts: (parentSessionId) => {
			set((state) => {
				const newMap = new Map(state.pendingContexts);
				newMap.delete(parentSessionId);
				return { pendingContexts: newMap };
			});
		},

		consumeContexts: (parentSessionId) => {
			const contexts = get().getContexts(parentSessionId);
			get().clearContexts(parentSessionId);
			return contexts;
		},
	}),
);
