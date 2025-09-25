import { writeSync } from 'node:fs';
import type {
	ToolCallRecord,
	ToolResultRecord,
	TokenUsageSummary,
} from './types.ts';
import { extractFilesFromPatch } from './transcript.ts';

export const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
export const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
export const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
export const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
export const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
export const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

export const colors = { bold, dim, cyan, green, yellow, red };

function writeStdout(text: string) {
	writeSync(1, text);
}

function writeStderr(text: string) {
	writeSync(2, text);
}

export function logToolError(
	name: string,
	message: string,
	opts?: { durationMs?: number },
) {
	const trimmed = message.trim();
	if (!trimmed.length) return;
	const time =
		typeof opts?.durationMs === 'number' ? dim(` (${opts.durationMs}ms)`) : '';
	writeStderr(
		`${bold('›')} ${cyan(name)} ${dim('›')} ${red('[ERROR]')} ${dim(trimmed)}${time}\n`,
	);
}

export function truncate(s: string, n: number) {
	if (s.length <= n) return s;
	return `${s.slice(0, n - 1)}…`;
}

export function stageBadge(stage: string) {
	switch (stage) {
		case 'planning':
			return `${dim('[planning]')}`;
		case 'discovering':
			return `${dim('[discovering]')}`;
		case 'generating':
			return `${dim('[generating]')}`;
		case 'preparing':
			return `${yellow('[preparing]')}`;
		case 'writing':
			return `${yellow('[writing]')}`;
		case 'verifying':
			return `${green('[verifying]')}`;
		default:
			return `${dim(`[${stage}]`)}`;
	}
}

export function detectPatchFormat(
	patch: string,
): 'unified' | 'enveloped' | 'unknown' {
	const s = String(patch || '');
	if (s.includes('*** Begin Patch')) return 'enveloped';
	if (
		/(^|\n)diff --git\s+/m.test(s) ||
		(/(^|\n)---\s+/m.test(s) && /(^|\n)\+\+\+\s+/m.test(s))
	)
		return 'unified';
	return 'unknown';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function printSummary(
	toolCalls: ToolCallRecord[],
	toolResults: ToolResultRecord[],
	filesTouched: Set<string>,
	usage?: TokenUsageSummary | null,
) {
	writeStderr(`\n${bold('Summary')}\n`);
	if (toolCalls.length) {
		writeStderr(`${bold('Tools used:')}\n`);
		const counts = new Map<string, number>();
		for (const c of toolCalls)
			counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
		for (const [name, count] of counts) {
			const suffix = count > 1 ? ` × ${count}` : '';
			writeStderr(`  ${green('•')} ${name}${suffix}\n`);
		}
	}
	if (filesTouched.size) {
		writeStderr(`${bold('Files touched:')}\n`);
		for (const f of filesTouched)
			writeStderr(`  ${green('•')} ${f}\n`);
	}
	const diffs = toolResults.filter((r) => r.artifact?.kind === 'file_diff');
	if (diffs.length) {
		writeStderr(`${bold('Diff artifacts:')}\n`);
		for (const d of diffs) {
			const s = d.artifact?.summary;
			const sum = s
				? ` (files:${s.files ?? '?'}, +${s.additions ?? '?'}, -${s.deletions ?? '?'})`
				: '';
			writeStderr(`  ${yellow('•')} ${d.name}${sum}\n`);
		}
	}
	if (usage) {
		const tokenLines: string[] = [];
		if (usage.inputTokens != null)
			tokenLines.push(`prompt=${usage.inputTokens}`);
		if (usage.outputTokens != null)
			tokenLines.push(`completion=${usage.outputTokens}`);
		if (usage.totalTokens != null)
			tokenLines.push(`total=${usage.totalTokens}`);
		if (tokenLines.length)
			writeStderr(`${bold('Token usage:')} ${tokenLines.join(', ')}\n`);
		if (usage.costUsd != null)
			writeStderr(`${bold('Estimated cost:')} ~$${usage.costUsd.toFixed(4)}\n`);
		if (usage.finishReason)
			writeStderr(`${bold('Finish reason:')} ${usage.finishReason}\n`);
	}
}

export function printPlan(items: unknown, note?: unknown) {
	try {
		if (!Array.isArray(items)) return;
		writeStderr(`\n${bold('Plan')}\n`);
		for (const it of items) {
			let step = '';
			let status = '';

			if (typeof it === 'string') {
				step = it;
				status = 'pending';
			} else if (typeof it === 'object' && it !== null) {
				const obj = it as { step?: unknown; status?: unknown };
				step = typeof obj.step === 'string' ? obj.step : String(obj.step ?? '');
				status = String(obj.status ?? '').toLowerCase();
			}

			if (!step || !step.trim()) continue;

			const checkbox = status === 'completed' ? '[x]' : '[ ]';
			let line = `${checkbox} ${step}`;

			if (status === 'in_progress') {
				line += ` ${yellow('...')}`;
			}

			writeStderr(`${line}\n`);
		}
		if (typeof note === 'string' && note.trim().length)
			writeStderr(`\n${dim(note.trim())}\n`);
		writeStderr('\n');
	} catch {}
}

export function printToolCall(
	name: string,
	args?: unknown,
	opts?: { verbose?: boolean },
) {
	if (name === 'progress_update') {
		try {
			writeStdout('\n');
		} catch {}
		const progressArgs: Record<string, unknown> = isPlainObject(args)
			? args
			: {};
		const msgValue = progressArgs.message;
		const msg =
			typeof msgValue === 'string'
				? msgValue
				: msgValue != null
					? String(msgValue)
					: '';
		const stageValue = progressArgs.stage;
		const stage =
			typeof stageValue === 'string' && stageValue.trim().length
				? stageValue
				: 'planning';
		const badge = stageBadge(stage);
		const line = `${badge} ${msg}`.trim();
		writeStderr(`${line}\n`);
		return;
	}
	const v = opts?.verbose;
	let summary = '';
	const a = (
		isPlainObject(args) ? (args as Record<string, unknown>) : {}
	) as Record<string, unknown>;
	if (name === 'read' && typeof a.path === 'string') summary = String(a.path);
	else if ((name === 'ls' || name === 'tree') && typeof a.path === 'string')
		summary = String(a.path || '.');
	else if (name === 'write' && typeof a.path === 'string')
		summary = String(a.path);
	else if (name === 'edit' && typeof a.path === 'string')
		summary = String(a.path);
	else if (name === 'bash' && typeof a.cmd === 'string') {
		const cmd = String(a.cmd).split('\n')[0] ?? '';
		const cwd = typeof a.cwd === 'string' ? a.cwd : undefined;
		const cwdSuffix = cwd && cwd !== '.' ? ` ${dim(`(cwd=${cwd})`)}` : '';
		summary = `${truncate(cmd, 200)}${cwdSuffix}`;
	} else if (name === 'apply_patch' && typeof a.patch === 'string') {
		const files = extractFilesFromPatch(String(a.patch));
		if (files.length === 1) summary = files[0];
		else if (files.length > 1)
			summary = `${files[0]} ${dim(`(+${files.length - 1} more)`)}`;
	} else if (name === 'ripgrep' && typeof a.query === 'string')
		summary = String(a.query);
	else if (name === 'git_diff') summary = a.all ? 'all' : 'staged';
	else if (v && args) summary = truncate(JSON.stringify(args), 120);
	const title = summary
		? `${bold('›')} ${cyan(name)} ${dim('›')} ${summary}`
		: `${bold('›')} ${cyan(name)}`;
	writeStderr(`\n${title}\n`);
}

export function printToolResult(
	name: string,
	result?: unknown,
	artifact?: unknown,
	opts?: {
		verbose?: boolean;
		durationMs?: number;
		error?: string;
		skipErrorLog?: boolean;
	},
) {
	if (name === 'update_plan' || name === 'progress_update') return;
	const time =
		typeof opts?.durationMs === 'number' ? dim(` (${opts.durationMs}ms)`) : '';
	const errorText = typeof opts?.error === 'string' ? opts.error.trim() : '';
	const hasArtifact = Boolean(artifact);
	let hasAdditionalResult = false;
	if (Array.isArray(result) && result.length) hasAdditionalResult = true;
	else if (result && typeof result === 'object') {
		const keys = Object.keys(result as Record<string, unknown>);
		const filtered = keys.filter(
			(key) => !['error', 'message', 'success'].includes(key),
		);
		hasAdditionalResult = filtered.length > 0;
	} else if (result !== undefined && result !== null && result !== '') {
		hasAdditionalResult = true;
	}
	if (errorText) {
		if (!opts?.skipErrorLog) logToolError(name, errorText, { durationMs: opts?.durationMs });
		if (!hasArtifact && !hasAdditionalResult) return;
	}
	if (
		name === 'tree' &&
		result &&
		typeof result === 'object' &&
		Reflect.get(result, 'tree')
	) {
		const tree = String(Reflect.get(result, 'tree') ?? '');
		const path = String(Reflect.get(result, 'path') ?? '.');
		writeStderr(`${bold('↳ tree')} ${dim(path)}${time}\n`);
		writeStderr(`${tree}\n`);
		return;
	}
	if (
		name === 'ls' &&
		result &&
		typeof result === 'object' &&
		Array.isArray(Reflect.get(result, 'entries'))
	) {
		const entries = Reflect.get(result, 'entries') as Array<{
			name: string;
			type: string;
		}>;
		const path = String(Reflect.get(result, 'path') ?? '.');
		writeStderr(`${bold('↳ ls')} ${dim(path)}${time}\n`);
		for (const e of entries.slice(0, 100)) {
			const badge = e.type === 'dir' ? '📁' : '📄';
			writeStderr(`  ${badge} ${e.name}\n`);
		}
		if (entries.length > 100)
			writeStderr(`${dim(`… and ${entries.length - 100} more`)}\n`);
		return;
	}
	if (
		name === 'read' &&
		result &&
		typeof result === 'object' &&
		typeof Reflect.get(result, 'path') === 'string'
	) {
		const path = String(Reflect.get(result, 'path'));
		const content = String(Reflect.get(result, 'content') ?? '');
		const lines = content.split('\n');
		writeStderr(`${bold('↳ read')} ${dim(path)} (${lines.length} lines)${time}\n`);
		const sample = lines.slice(0, 20).join('\n');
		const suffix = lines.length > 20 ? `\n${dim('…')}` : '';
		writeStderr(`${sample}${suffix}\n`);
		return;
	}
	if (
		name === 'write' &&
		result &&
		typeof result === 'object' &&
		typeof Reflect.get(result, 'path') === 'string'
	) {
		const path = String(Reflect.get(result, 'path'));
		const bytes = Reflect.get(result, 'bytes');
		const bytesStr =
			typeof bytes === 'number' ? `${bytes} bytes` : `${bytes ?? '?'}`;
		writeStderr(`${bold('↳ wrote')} ${path} (${bytesStr})${time}\n`);
	}
	if (
		artifact &&
		typeof artifact === 'object' &&
		Reflect.get(artifact, 'kind') === 'file_diff' &&
		typeof Reflect.get(artifact, 'patch') === 'string'
	) {
		const patch = String(Reflect.get(artifact, 'patch'));
		const pf = detectPatchFormat(patch);
		const label = pf === 'unified' ? '(unified patch)' : '(patch)';
		writeStderr(`${bold('↳ diff')} ${dim(label)}${time}\n`);
		const rawLines = patch.split('\n');
		const shown = rawLines.slice(0, 120);
		for (const line of shown) {
			if (line.startsWith('+') && !line.startsWith('+++'))
				writeStderr(`${green(line)}\n`);
			else if (line.startsWith('-') && !line.startsWith('---'))
				writeStderr(`${red(line)}\n`);
			else if (
				line.startsWith('***') ||
				line.startsWith('diff --git') ||
				line.startsWith('index ') ||
				line.startsWith('--- ') ||
				line.startsWith('+++ ') ||
				line.startsWith('@@ ')
			)
				writeStderr(`${dim(line)}\n`);
			else writeStderr(`${line}\n`);
		}
		if (rawLines.length > shown.length) writeStderr(`${dim('…')}\n`);
		return;
	}
	if (name === 'bash' && result && typeof result === 'object') {
		const MAX_OUTPUT_LINES = 80;
		const MAX_OUTPUT_CHARS = 6000;
		const stdout = String(Reflect.get(result, 'stdout') ?? '');
		const stderr = String(Reflect.get(result, 'stderr') ?? '');
		const exitCode = Reflect.get(result, 'exitCode');
		const truncateBlock = (
			label: string,
			raw: string,
			colorize?: (value: string) => string,
		) => {
			const lines = raw.split('\n');
			const overLineLimit = lines.length > MAX_OUTPUT_LINES;
			const limitedLines = overLineLimit
				? lines.slice(0, MAX_OUTPUT_LINES)
				: lines;
			let text = limitedLines.join('\n');
			const overCharLimit = text.length > MAX_OUTPUT_CHARS;
			if (overCharLimit) text = text.slice(0, MAX_OUTPUT_CHARS);
			const truncated = overLineLimit || overCharLimit;
			if (!text.trim()) return;
			const body = colorize ? colorize(text) : text;
			writeStderr(`${bold(label)}${time}\n${body}${text.endsWith('\n') ? '' : '\n'}`);
			if (truncated) {
				writeStderr(
					`${dim('… output truncated; rerun with --json or --json-stream for full logs')}\n`,
				);
			}
		};
		if (stdout.trim()) truncateBlock('↳ bash stdout', stdout);
		if (stderr.trim()) truncateBlock('↳ bash stderr', stderr, red);
		if (typeof exitCode === 'number')
			writeStderr(`${bold('↳ bash exit')} ${exitCode}${time}\n`);
		return;
	}
	if (name === 'finish') {
		writeStderr(`${bold('✓ done')}${time}\n`);
		return;
	}
	const preview =
		result !== undefined ? truncate(JSON.stringify(result), 200) : '';
	const artifactKind =
		artifact && typeof artifact === 'object'
			? String(Reflect.get(artifact, 'kind') ?? '')
			: '';
	const suffix = artifactKind ? ` ${dim(`artifact=${artifactKind}`)}` : '';
	writeStderr(`${bold('↳')} ${cyan(name)}${suffix} ${preview}\n`);
}

export function streamJsonDelta(payload: Record<string, unknown>) {
	writeStdout(`${JSON.stringify(payload)}\n`);
}
