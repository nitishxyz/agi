const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

const SYNONYMS: Record<string, string> = {
	debug: 'log',
	logs: 'log',
	logging: 'log',
	trace: 'log',
	verbose: 'log',
	log: 'log',
	time: 'timing',
	timing: 'timing',
	timings: 'timing',
	perf: 'timing',
};

type DebugConfig = { flags: Set<string> };

let cachedConfig: DebugConfig | null = null;

function isTruthy(raw: string | undefined): boolean {
	if (!raw) return false;
	const trimmed = raw.trim().toLowerCase();
	if (!trimmed) return false;
	return TRUTHY.has(trimmed) || trimmed === 'all';
}

function normalizeToken(token: string): string {
	const trimmed = token.trim().toLowerCase();
	if (!trimmed) return '';
	if (TRUTHY.has(trimmed) || trimmed === 'all') return 'all';
	return SYNONYMS[trimmed] ?? trimmed;
}

function parseDebugConfig(): DebugConfig {
	const flags = new Set<string>();
	const sources = [process.env.AGI_DEBUG, process.env.DEBUG_AGI];
	let sawValue = false;
	for (const raw of sources) {
		if (typeof raw !== 'string') continue;
		const trimmed = raw.trim();
		if (!trimmed) continue;
		sawValue = true;
		const tokens = trimmed.split(/[\s,]+/);
		let matched = false;
		for (const token of tokens) {
			const normalized = normalizeToken(token);
			if (!normalized) continue;
			matched = true;
			flags.add(normalized);
		}
		if (!matched && isTruthy(trimmed)) flags.add('all');
	}
	if (isTruthy(process.env.AGI_DEBUG_TIMING)) flags.add('timing');
	if (!flags.size && sawValue) flags.add('all');
	return { flags };
}

function getDebugConfig(): DebugConfig {
	if (!cachedConfig) cachedConfig = parseDebugConfig();
	return cachedConfig;
}

export function isDebugEnabled(flag?: string): boolean {
	const config = getDebugConfig();
	if (config.flags.has('all')) return true;
	if (flag) return config.flags.has(flag);
	return config.flags.has('log');
}

export function debugLog(...args: unknown[]) {
	if (!isDebugEnabled('log')) return;
	try {
		console.log('[debug]', ...args);
	} catch {}
}

function nowMs(): number {
	const perf = (globalThis as { performance?: { now?: () => number } })
		.performance;
	if (perf && typeof perf.now === 'function') return perf.now();
	return Date.now();
}

type Timer = { end(meta?: Record<string, unknown>): void };

export function time(label: string): Timer {
	if (!isDebugEnabled('timing')) {
		return { end() {} };
	}
	const start = nowMs();
	let finished = false;
	return {
		end(meta?: Record<string, unknown>) {
			if (finished) return;
			finished = true;
			const duration = nowMs() - start;
			try {
				const line = `[timing] ${label} ${duration.toFixed(1)}ms`;
				if (meta && Object.keys(meta).length) console.log(line, meta);
				else console.log(line);
			} catch {}
		},
	};
}
