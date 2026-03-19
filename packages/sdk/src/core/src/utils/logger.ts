import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isDebugEnabled, isTraceEnabled, getDebugScopes } from './debug.ts';
import {
	getGlobalDebugLogPath,
	getSessionDebugDetailsLogPath,
	getSessionDebugLogPath,
} from '../../../config/src/paths.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const ANSI_RESET = '\x1b[0m';
const ANSI_DIM = '\x1b[2m';
const ANSI_CYAN = '\x1b[36m';
const ANSI_BLUE = '\x1b[34m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_RED = '\x1b[31m';

function safeHasMeta(
	meta?: Record<string, unknown>,
): meta is Record<string, unknown> {
	return Boolean(meta && Object.keys(meta).length);
}

function getDebugLogFilePath(): string | undefined {
	if (!isDebugEnabled()) return undefined;
	return getGlobalDebugLogPath();
}

function getSessionLogFilePath(
	meta?: Record<string, unknown>,
): string | undefined {
	if (!isDebugEnabled()) return undefined;
	if (meta?.debugDetail === true) return undefined;
	const sessionId = meta?.sessionId;
	if (typeof sessionId !== 'string' || !sessionId.trim()) return undefined;
	return getSessionDebugLogPath(sessionId);
}

function getSessionDetailsLogFilePath(
	meta?: Record<string, unknown>,
): string | undefined {
	if (!isDebugEnabled()) return undefined;
	const sessionId = meta?.sessionId;
	if (typeof sessionId !== 'string' || !sessionId.trim()) return undefined;
	return getSessionDebugDetailsLogPath(sessionId);
}

function shouldWriteDebugLog(message: string): boolean {
	if (!isDebugEnabled()) return false;
	const scopes = getDebugScopes();
	if (!scopes.length) return true;
	const match = message.match(/^\[([^\]]+)\]/);
	if (!match?.[1]) return true;
	return scopes.includes(match[1]);
}

function serializeLogMeta(meta?: Record<string, unknown>): string {
	if (!safeHasMeta(meta)) return '';
	try {
		const sanitized = { ...meta };
		delete sanitized.debugDetail;
		return Object.keys(sanitized).length ? ` ${JSON.stringify(sanitized)}` : '';
	} catch {
		return ' [unserializable-meta]';
	}
}

function colorizeLine(line: string, level: LogLevel): string {
	const levelColor =
		level === 'debug'
			? ANSI_CYAN
			: level === 'info'
				? ANSI_BLUE
				: level === 'warn'
					? ANSI_YELLOW
					: ANSI_RED;
	const scopeMatch = line.match(/\[(debug|info|warn|error|timing)\]\s+\[([^\]]+)\]/i);
	if (!scopeMatch) {
		return `${levelColor}${line}${ANSI_RESET}`;
	}
	const rest = line.slice(24);
	return `${ANSI_DIM}${line.slice(0, 24)}${ANSI_RESET}${rest.replace(
		scopeMatch[1],
		`${levelColor}${scopeMatch[1]}${ANSI_RESET}`,
	).replace(
		`[${scopeMatch[2]}]`,
		`${ANSI_GREEN}[${scopeMatch[2]}]${ANSI_RESET}`,
	)}`;
}

function printLine(level: LogLevel, line: string, meta?: Record<string, unknown>) {
	const colored = colorizeLine(line, level);
	if (safeHasMeta(meta)) {
		if (level === 'warn') console.warn(colored, meta);
		else if (level === 'error') console.error(colored, meta);
		else console.log(colored, meta);
		return;
	}
	if (level === 'warn') console.warn(colored);
	else if (level === 'error') console.error(colored);
	else console.log(colored);
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

	const sessionLogFile = getSessionLogFilePath(meta);
	if (sessionLogFile) {
		try {
			mkdirSync(dirname(sessionLogFile), { recursive: true });
			appendFileSync(sessionLogFile, `${fullLine}\n`, 'utf-8');
		} catch {
			// ignore file logging errors
		}
	}

	const sessionDetailsLogFile = getSessionDetailsLogFilePath(meta);
	if (sessionDetailsLogFile) {
		try {
			mkdirSync(dirname(sessionDetailsLogFile), { recursive: true });
			appendFileSync(sessionDetailsLogFile, `${fullLine}\n`, 'utf-8');
		} catch {
			// ignore file logging errors
		}
	}

	return fullLine;
}

export function debug(message: string, meta?: Record<string, unknown>): void {
	if (!shouldWriteDebugLog(message)) return;
	try {
		const line = writeLogLine(`[debug] ${message}`, meta);
		printLine('debug', line, meta);
	} catch {
		// ignore logging errors
	}
}

export function info(message: string, meta?: Record<string, unknown>): void {
	if (!shouldWriteDebugLog(message) && !isTraceEnabled()) return;
	try {
		const line = writeLogLine(`[info] ${message}`, meta);
		printLine('info', line, meta);
	} catch {
		// ignore logging errors
	}
}

export function warn(message: string, meta?: Record<string, unknown>): void {
	try {
		const line = writeLogLine(`[warn] ${message}`, meta);
		printLine('warn', line, meta);
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
			printLine('error', line, logMeta);
		} else {
			const line = writeLogLine(`[error] ${message}`);
			printLine('error', line);
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
				printLine('info', base, meta);
			} catch {
				// ignore timing log errors
			}
		},
	};
}
