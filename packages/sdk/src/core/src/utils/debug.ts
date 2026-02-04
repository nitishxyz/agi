const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

type GlobalDebugFlags = {
	__OTTO_DEBUG_ENABLED__?: boolean;
	__OTTO_TRACE_ENABLED__?: boolean;
};

function readGlobalFlag(
	key: '__OTTO_DEBUG_ENABLED__' | '__OTTO_TRACE_ENABLED__',
) {
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
	const globalFlag = readGlobalFlag('__OTTO_DEBUG_ENABLED__');
	if (typeof globalFlag === 'boolean') {
		return globalFlag;
	}
	return envEnabled(['OTTO_DEBUG', 'DEBUG_OTTO']);
}

export function isTraceEnabled(): boolean {
	const globalFlag = readGlobalFlag('__OTTO_TRACE_ENABLED__');
	if (typeof globalFlag === 'boolean') {
		return Boolean(globalFlag) && isDebugEnabled();
	}
	return envEnabled(['OTTO_TRACE', 'TRACE_OTTO']) && isDebugEnabled();
}
