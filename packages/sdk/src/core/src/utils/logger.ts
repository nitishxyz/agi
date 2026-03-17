import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isDebugEnabled, isTraceEnabled } from './debug.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function safeHasMeta(
	meta?: Record<string, unknown>,
): meta is Record<string, unknown> {
	return Boolean(meta && Object.keys(meta).length);
}

function getDebugLogFilePath(): string | undefined {
	const raw = process.env.OTTO_DEBUG_FILE?.trim();
	return raw ? raw : undefined;
}

function serializeLogMeta(meta?: Record<string, unknown>): string {
	if (!safeHasMeta(meta)) return '';
	try {
		return ` ${JSON.stringify(meta)}`;
	} catch {
		return ' [unserializable-meta]';
	}
}

function writeLogLine(line: string, meta?: Record<string, unknown>) {
	const suffix = serializeLogMeta(meta);
	const fullLine = `${new Date().toISOString()} ${line}${suffix}`;
	const logFile = getDebugLogFilePath();

	if (logFile) {
		try {
			mkdirSync(dirname(logFile), { recursive: true });
			appendFileSync(logFile, `${fullLine}\n`, 'utf-8');
		} catch {
			// ignore file logging errors
		}
	}

	return fullLine;
}

export function debug(message: string, meta?: Record<string, unknown>): void {
	if (!isDebugEnabled()) return;
	try {
		const line = writeLogLine(`[debug] ${message}`, meta);
		if (safeHasMeta(meta)) {
			console.log(line, meta);
		} else {
			console.log(line);
		}
	} catch {
		// ignore logging errors
	}
}

export function info(message: string, meta?: Record<string, unknown>): void {
	if (!isDebugEnabled() && !isTraceEnabled()) return;
	try {
		const line = writeLogLine(`[info] ${message}`, meta);
		if (safeHasMeta(meta)) {
			console.log(line, meta);
		} else {
			console.log(line);
		}
	} catch {
		// ignore logging errors
	}
}

export function warn(message: string, meta?: Record<string, unknown>): void {
	try {
		const line = writeLogLine(`[warn] ${message}`, meta);
		if (safeHasMeta(meta)) {
			console.warn(line, meta);
		} else {
			console.warn(line);
		}
	} catch {
		// ignore logging errors
	}
}

export function error(
	message: string,
	err?: unknown,
	meta?: Record<string, unknown>,
): void {
	if (!isDebugEnabled()) return;

	try {
		const logMeta: Record<string, unknown> = meta ? { ...meta } : {};

		if (err) {
			if (err instanceof Error) {
				logMeta.error = {
					name: err.name,
					message: err.message,
				};
				if (isTraceEnabled() && err.stack) {
					(logMeta.error as { stack?: string }).stack = err.stack;
				}
			} else if (typeof err === 'string') {
				logMeta.error = err;
			} else if (typeof err === 'object') {
				const errObj = err as Record<string, unknown>;
				const details: Record<string, unknown> = {};
				if (typeof errObj.name === 'string') details.name = errObj.name;
				if (typeof errObj.message === 'string')
					details.message = errObj.message;
				if (typeof errObj.code === 'string') details.code = errObj.code;
				if (typeof errObj.status === 'number') details.status = errObj.status;
				if (typeof errObj.statusCode === 'number')
					details.statusCode = errObj.statusCode;
				if (
					isTraceEnabled() &&
					typeof errObj.stack === 'string' &&
					!details.stack
				) {
					details.stack = errObj.stack;
				}
				logMeta.error = Object.keys(details).length ? details : errObj;
			} else {
				logMeta.error = String(err);
			}
		}

		if (safeHasMeta(logMeta)) {
			const line = writeLogLine(`[error] ${message}`, logMeta);
			console.error(line, logMeta);
		} else {
			const line = writeLogLine(`[error] ${message}`);
			console.error(line);
		}
	} catch (logErr) {
		try {
			console.error(`[error] ${message} (logging failed)`, logErr);
		} catch {
			// ignore
		}
	}
}

export const logger = {
	debug,
	info,
	warn,
	error,
};

function nowMs(): number {
	const perf = (globalThis as { performance?: { now?: () => number } })
		.performance;
	if (perf && typeof perf.now === 'function') return perf.now();
	return Date.now();
}

type Timer = {
	end(meta?: Record<string, unknown>): void;
};

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
				const base = writeLogLine(
					`[timing] ${label} ${duration.toFixed(1)}ms`,
					meta,
				);
				if (safeHasMeta(meta)) {
					console.log(base, meta);
				} else {
					console.log(base);
				}
			} catch {
				// ignore timing log errors
			}
		},
	};
}
