import { logger } from '@ottocode/sdk';

export type TopupMethod = 'crypto' | 'fiat';

export interface PendingTopup {
	sessionId: string;
	messageId: string;
	amountUsd: number;
	currentBalance: number;
	resolve: (method: TopupMethod) => void;
	reject: (error: Error) => void;
	createdAt: number;
}

const TOPUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const pendingTopups = new Map<string, PendingTopup>();
const timeoutIds = new Map<string, ReturnType<typeof setTimeout>>();

export function waitForTopupMethodSelection(
	sessionId: string,
	messageId: string,
	amountUsd: number,
	currentBalance: number,
): Promise<TopupMethod> {
	return new Promise((resolve, reject) => {
		const existing = pendingTopups.get(sessionId);
		if (existing) {
			existing.reject(new Error('Superseded by new topup request'));
			clearPendingTopup(sessionId);
		}

		const pending: PendingTopup = {
			sessionId,
			messageId,
			amountUsd,
			currentBalance,
			resolve,
			reject,
			createdAt: Date.now(),
		};

		pendingTopups.set(sessionId, pending);

		const timeoutId = setTimeout(() => {
			const p = pendingTopups.get(sessionId);
			if (p) {
				logger.warn(`Topup selection timeout for session ${sessionId}`);
				p.reject(new Error('Topup selection timeout'));
				clearPendingTopup(sessionId);
			}
		}, TOPUP_TIMEOUT_MS);

		timeoutIds.set(sessionId, timeoutId);
	});
}

export function resolveTopupMethodSelection(
	sessionId: string,
	method: TopupMethod,
): boolean {
	const pending = pendingTopups.get(sessionId);
	if (!pending) {
		logger.warn(
			`No pending topup found for session ${sessionId} when trying to resolve`,
		);
		return false;
	}

	pending.resolve(method);
	clearPendingTopup(sessionId);
	return true;
}

export function rejectTopupSelection(
	sessionId: string,
	reason: string,
): boolean {
	const pending = pendingTopups.get(sessionId);
	if (!pending) {
		return false;
	}

	pending.reject(new Error(reason));
	clearPendingTopup(sessionId);
	return true;
}

export function getPendingTopup(sessionId: string): PendingTopup | undefined {
	return pendingTopups.get(sessionId);
}

export function hasPendingTopup(sessionId: string): boolean {
	return pendingTopups.has(sessionId);
}

export function clearPendingTopup(sessionId: string): void {
	const timeoutId = timeoutIds.get(sessionId);
	if (timeoutId) {
		clearTimeout(timeoutId);
		timeoutIds.delete(sessionId);
	}
	pendingTopups.delete(sessionId);
}

export function clearAllPendingTopups(): void {
	for (const sessionId of pendingTopups.keys()) {
		clearPendingTopup(sessionId);
	}
}
