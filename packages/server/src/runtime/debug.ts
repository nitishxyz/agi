/**
 * Legacy debug utilities - now integrated with new logger
 *
 * This file maintains backward compatibility while using the new
 * centralized debug-state and logger modules.
 */

import { isDebugEnabled as isDebugEnabledNew } from './debug-state';
import { time as timeNew, debug as debugNew } from './logger';

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

/**
 * Check if debug mode is enabled for a specific flag
 * Now uses the centralized debug state
 *
 * @deprecated Use isDebugEnabled from debug-state.ts instead
 */
export function isDebugEnabled(flag?: string): boolean {
	// Use new centralized debug state for general debug
	if (!flag || flag === 'log') {
		return isDebugEnabledNew();
	}

	// For specific flags like 'timing', check both new state and legacy env vars
	if (flag === 'timing') {
		// If new debug state is enabled OR timing flag is set
		if (isDebugEnabledNew()) return true;
	}

	// Legacy flag checking
	const config = getDebugConfig();
	if (config.flags.has('all')) return true;
	if (flag) return config.flags.has(flag);
	return config.flags.has('log');
}

/**
 * Log debug message
 * Now uses the centralized logger
 *
 * @deprecated Use logger.debug from logger.ts instead
 */
export function debugLog(...args: unknown[]) {
	if (!isDebugEnabled('log')) return;
	debugNew(args.map((arg) => String(arg)).join(' '));
}

/**
 * Create a timer for performance measurement
 * Integrated with centralized logger
 */
export function time(label: string): {
	end(meta?: Record<string, unknown>): void;
} {
	return timeNew(label);
}
