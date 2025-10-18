const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

type GlobalDebugFlags = {
	__AGI_DEBUG_ENABLED__?: boolean;
	__AGI_TRACE_ENABLED__?: boolean;
};

function readGlobalFlag(key: '__AGI_DEBUG_ENABLED__' | '__AGI_TRACE_ENABLED__') {
	const globalState = globalThis as GlobalDebugFlags;
	return globalState[key];
}

function envEnabled(keys: string[]): boolean {
	for (const key of keys) {
		const raw = typeof process !== 'undefined' ? process.env?.[key] : undefined;
		if (!raw) continue;
		const trimmed = raw.trim().toLowerCase();
		if (!trimmed) continue;
		if (TRUTHY.has(trimmed) || trimmed === 'all') return true;
	}
	return false;
}

export function isDebugEnabled(): boolean {
	const globalFlag = readGlobalFlag('__AGI_DEBUG_ENABLED__');
	if (typeof globalFlag === 'boolean') {
		return globalFlag;
	}
	return envEnabled(['AGI_DEBUG', 'DEBUG_AGI']);
}

export function isTraceEnabled(): boolean {
	const globalFlag = readGlobalFlag('__AGI_TRACE_ENABLED__');
	if (typeof globalFlag === 'boolean') {
		return Boolean(globalFlag) && isDebugEnabled();
	}
	return envEnabled(['AGI_TRACE', 'TRACE_AGI']) && isDebugEnabled();
}
