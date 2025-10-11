/**
 * Centralized logging utility
 * 
 * Provides structured logging with debug mode awareness.
 * Replaces scattered console.log calls throughout the codebase.
 */

import { isDebugEnabled, isTraceEnabled } from './debug-state';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogOptions = {
	meta?: Record<string, unknown>;
	stack?: boolean;
};

/**
 * Format a log message with optional metadata
 */
function formatMessage(
	level: LogLevel,
	message: string,
	meta?: Record<string, unknown>,
): string {
	const timestamp = new Date().toISOString();
	const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
	
	if (meta && Object.keys(meta).length > 0) {
		return `${prefix} ${message} ${JSON.stringify(meta)}`;
	}
	
	return `${prefix} ${message}`;
}

/**
 * Log at debug level (only when debug mode is enabled)
 */
export function debug(message: string, meta?: Record<string, unknown>): void {
	if (!isDebugEnabled()) return;
	
	try {
		if (meta && Object.keys(meta).length > 0) {
			console.log(`[debug] ${message}`, meta);
		} else {
			console.log(`[debug] ${message}`);
		}
	} catch {
		// Silently fail
	}
}

/**
 * Log informational messages
 */
export function info(message: string, meta?: Record<string, unknown>): void {
	try {
		if (meta && Object.keys(meta).length > 0) {
			console.log(`[info] ${message}`, meta);
		} else {
			console.log(`[info] ${message}`);
		}
	} catch {
		// Silently fail
	}
}

/**
 * Log warning messages
 */
export function warn(message: string, meta?: Record<string, unknown>): void {
	try {
		if (meta && Object.keys(meta).length > 0) {
			console.warn(`[warn] ${message}`, meta);
		} else {
			console.warn(`[warn] ${message}`);
		}
	} catch {
		// Silently fail
	}
}

/**
 * Log error messages (only in debug mode, stack trace only with --trace)
 */
export function error(
	message: string,
	err?: unknown,
	meta?: Record<string, unknown>,
): void {
	// Only log errors when debug mode is enabled
	if (!isDebugEnabled()) return;
	
	try {
		const logMeta: Record<string, unknown> = { ...meta };
		
		if (err) {
			if (err instanceof Error) {
				// Always show error name and message in debug mode
				logMeta.error = {
					name: err.name,
					message: err.message,
				};
				
				// Show full stack trace only with --trace flag
				if (isTraceEnabled() && err.stack) {
					logMeta.error.stack = err.stack;
				}
			} else if (typeof err === 'string') {
				logMeta.error = err;
			} else if (err && typeof err === 'object') {
				// For other error objects, try to extract useful info
				const errObj = err as Record<string, unknown>;
				logMeta.error = {
					...(typeof errObj.name === 'string' ? { name: errObj.name } : {}),
					...(typeof errObj.message === 'string' ? { message: errObj.message } : {}),
					...(typeof errObj.code === 'string' ? { code: errObj.code } : {}),
					...(typeof errObj.status === 'number' ? { status: errObj.status } : {}),
					...(typeof errObj.statusCode === 'number' ? { statusCode: errObj.statusCode } : {}),
				};
				
				// Include stack in trace mode
				if (isTraceEnabled() && typeof errObj.stack === 'string') {
					logMeta.error.stack = errObj.stack;
				}
			} else {
				// Fallback for primitive types
				logMeta.error = String(err);
			}
		}
		
		if (Object.keys(logMeta).length > 0) {
			console.error(`[error] ${message}`, logMeta);
		} else {
			console.error(`[error] ${message}`);
		}
	} catch (logErr) {
		// Last resort: at least try to log something
		try {
			console.error(`[error] ${message} (logging failed:`, logErr, ')');
		} catch {
			// Give up silently
		}
	}
}

/**
 * Logger object with all methods
 */
export const logger = {
	debug,
	info,
	warn,
	error,
};

/**
 * Timing utilities (integrates with existing debug.ts timing)
 */
function nowMs(): number {
	const perf = (globalThis as { performance?: { now?: () => number } })
		.performance;
	if (perf && typeof perf.now === 'function') return perf.now();
	return Date.now();
}

type Timer = { 
	end(meta?: Record<string, unknown>): void;
};

/**
 * Create a timer for performance measurement
 * Only active when debug mode is enabled
 */
export function time(label: string): Timer {
	if (!isDebugEnabled()) {
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
				if (meta && Object.keys(meta).length) {
					console.log(line, meta);
				} else {
					console.log(line);
				}
			} catch {
				// Silently fail
			}
		},
	};
}

// Export legacy compatibility
export { isDebugEnabled, isTraceEnabled };
