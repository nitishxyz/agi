import type { OttoEvent } from './types.ts';

type Subscriber = (evt: OttoEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>(); // sessionId -> subs

function sanitizeBigInt<T>(obj: T): T {
	if (obj === null || obj === undefined) return obj;
	if (typeof obj === 'bigint') return Number(obj) as T;
	if (Array.isArray(obj)) return obj.map(sanitizeBigInt) as T;
	if (typeof obj === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			result[key] = sanitizeBigInt(value);
		}
		return result as T;
	}
	return obj;
}

export function publish(event: OttoEvent) {
	const sanitizedEvent = sanitizeBigInt(event);
	const subs = subscribers.get(event.sessionId);
	if (!subs) return;
	for (const sub of subs) {
		try {
			sub(sanitizedEvent);
		} catch {}
	}
}

export function subscribe(sessionId: string, handler: Subscriber) {
	let set = subscribers.get(sessionId);
	if (!set) {
		set = new Set();
		subscribers.set(sessionId, set);
	}
	set.add(handler);
	return () => {
		set?.delete(handler);
		if (set && set.size === 0) subscribers.delete(sessionId);
	};
}
