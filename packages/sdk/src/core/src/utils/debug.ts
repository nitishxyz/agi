import { readFileSync } from 'node:fs';
import { getGlobalConfigPath } from '../../../config/src/paths.ts';

type DebugSettings = {
	debugEnabled?: boolean;
	debugScopes?: unknown;
};

let debugEnabledOverride: boolean | undefined;
let traceEnabledOverride: boolean | undefined;

function readDebugSettings(): DebugSettings {
	try {
		const raw = readFileSync(getGlobalConfigPath(), 'utf-8');
		const parsed = JSON.parse(raw) as DebugSettings;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

export function isDebugEnabled(): boolean {
	if (debugEnabledOverride !== undefined) return debugEnabledOverride;
	return readDebugSettings().debugEnabled === true;
}

export function isTraceEnabled(): boolean {
	if (traceEnabledOverride !== undefined) return traceEnabledOverride;
	return false;
}

export function setDebugEnabled(enabled: boolean): void {
	debugEnabledOverride = enabled;
}

export function setTraceEnabled(enabled: boolean): void {
	traceEnabledOverride = enabled;
}

export function getDebugScopes(): string[] {
	const scopes = readDebugSettings().debugScopes;
	if (!Array.isArray(scopes)) return [];
	return scopes.filter(
		(scope): scope is string =>
			typeof scope === 'string' && scope.trim().length > 0,
	);
}
