import { readFileSync } from 'node:fs';
import { getGlobalConfigPath } from '../../../config/src/paths.ts';

type DebugSettings = {
	debugEnabled?: boolean;
	debugScopes?: unknown;
};

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
	return readDebugSettings().debugEnabled === true;
}

export function isTraceEnabled(): boolean {
	return false;
}

export function getDebugScopes(): string[] {
	const scopes = readDebugSettings().debugScopes;
	if (!Array.isArray(scopes)) return [];
	return scopes.filter(
		(scope): scope is string =>
			typeof scope === 'string' && scope.trim().length > 0,
	);
}
