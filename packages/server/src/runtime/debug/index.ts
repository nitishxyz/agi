/**
 * Legacy debug utilities - now integrated with new logger
 *
 * This file maintains backward compatibility while using the new
 * centralized debug-state and logger modules.
 */

import { time as timeNew } from '@ottocode/sdk';

/**
 * Check if debug mode is enabled for a specific flag
 * Now uses the centralized debug state
 *
 * @deprecated Use isDebugEnabled from debug-state.ts instead
 */
export function isDebugEnabled(flag?: string): boolean {
	void flag;
	return false;
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
