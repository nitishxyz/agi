export function isDebugEnabled(flag?: string): boolean {
	void flag;
	return false;
}

function nowMs(): number {
	const perf = (globalThis as { performance?: { now?: () => number } })
		.performance;
	if (perf && typeof perf.now === 'function') return perf.now();
	return Date.now();
}

type Timer = { end(meta?: Record<string, unknown>): void };

export function time(label: string): Timer {
	void label;
	return {
		end(meta?: Record<string, unknown>) {
			void meta;
		},
	};
}
