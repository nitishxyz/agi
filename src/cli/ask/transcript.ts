import type {
	AssistantChunk,
	AssistantLine,
	AssistantSegment,
	SequenceEntry,
	ToolCallRecord,
	ToolResultRecord,
	TokenUsageSummary,
} from './types.ts';

export function computeAssistantLines(
	chunks: AssistantChunk[],
): AssistantLine[] {
	const lines: AssistantLine[] = [];
	let buffer = '';
	let startTs = chunks.length ? chunks[0].ts : Date.now();
	let index = 0;
	for (const { ts, delta } of chunks) {
		let remaining = delta;
		while (remaining.includes('\n')) {
			const i = remaining.indexOf('\n');
			const part = remaining.slice(0, i);
			buffer += part;
			const text = buffer.trim();
			if (text.length)
				lines.push({ index: index++, tsStart: startTs, tsEnd: ts, text });
			buffer = '';
			startTs = ts;
			remaining = remaining.slice(i + 1);
		}
		buffer += remaining;
	}
	if (buffer.trim().length) {
		lines.push({
			index: index++,
			tsStart: startTs,
			tsEnd: chunks.length ? chunks[chunks.length - 1].ts : startTs,
			text: buffer.trim(),
		});
	}
	return lines;
}

export function computeAssistantSegments(
	chunks: AssistantChunk[],
	calls: Array<{ ts: number }>,
): AssistantSegment[] {
	const segments: AssistantSegment[] = [];
	if (!chunks.length) return segments;
	const callTimes = calls.map((c) => c.ts).sort((a, b) => a - b);
	let buffer = '';
	let startTs = chunks[0].ts;
	let segIndex = 0;
	let callIdx = 0;

	for (const { ts, delta } of chunks) {
		while (callIdx < callTimes.length && ts >= callTimes[callIdx]) {
			if (buffer.trim().length) {
				segments.push({
					index: segIndex++,
					tsStart: startTs,
					tsEnd: ts,
					text: buffer.trim(),
				});
				buffer = '';
			}
			startTs = ts;
			callIdx++;
		}
		buffer += delta;
	}
	if (buffer.trim().length) {
		segments.push({
			index: segIndex++,
			tsStart: startTs,
			tsEnd: chunks[chunks.length - 1].ts,
			text: buffer.trim(),
		});
	}
	return segments;
}

export function buildSequence(args: {
	prompt: string;
	assistantSegments: AssistantSegment[];
	toolCalls: ToolCallRecord[];
	toolResults: ToolResultRecord[];
}): SequenceEntry[] {
	const seq: SequenceEntry[] = [];
	seq.push({
		type: 'user',
		ts: args.assistantSegments[0]?.tsStart ?? Date.now(),
		text: args.prompt,
	});

	for (const l of args.assistantSegments) {
		seq.push({
			type: 'assistant',
			tsStart: l.tsStart,
			tsEnd: l.tsEnd,
			index: l.index,
			text: l.text,
		});
	}

	for (const c of args.toolCalls)
		seq.push({
			type: 'tool.call',
			ts: c.ts,
			name: c.name,
			callId: c.callId,
			args: c.args,
		});

	for (const r of args.toolResults)
		seq.push({
			type: 'tool.result',
			ts: r.ts,
			name: r.name,
			callId: r.callId,
			durationMs: r.durationMs,
			result: r.result,
			artifact: r.artifact,
		});

	seq.sort((a, b) => {
		const ta = 'tsStart' in a ? a.tsStart : (a.ts ?? 0);
		const tb = 'tsStart' in b ? b.tsStart : (b.ts ?? 0);
		return ta - tb;
	});
	return seq;
}

export function extractFilesFromPatch(patch: string): string[] {
	const lines = String(patch || '').split('\n');
	const files: string[] = [];
	const codexRe = /^\*\*\*\s+(Add|Update|Delete) File:\s+(.+)$/;
	const diffGitRe = /^diff --git\s+a\/(.+?)\s+b\/(.+?)$/;
	const minusRe = /^---\s+a\/(.+)$/;
	const plusRe = /^\+\+\+\s+b\/(.+)$/;
	for (const line of lines) {
		let m = line.match(codexRe);
		if (m) {
			files.push(m[2]);
			continue;
		}
		m = line.match(diffGitRe);
		if (m) {
			files.push(m[1]);
			continue;
		}
		m = line.match(minusRe);
		if (m) {
			files.push(m[1]);
			continue;
		}
		m = line.match(plusRe);
		if (m) {
			files.push(m[1]);
		}
	}
	const seen = new Set<string>();
	const out: string[] = [];
	for (const f of files) {
		if (!seen.has(f)) {
			seen.add(f);
			out.push(f);
		}
	}
	return out;
}

export function toNumberOrUndefined(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed.length) return undefined;
		const parsed = Number(trimmed);
		if (Number.isFinite(parsed)) return parsed;
	}
	return undefined;
}

export type UsageAggregate = {
	toolCounts: Record<string, number>;
	toolTimings: Array<{ name: string; durationMs: number }>;
	totalToolTimeMs: number;
};

export function summarizeTools(
	toolCalls: ToolCallRecord[],
	toolResults: ToolResultRecord[],
) {
	const toolCounts: Record<string, number> = {};
	for (const c of toolCalls) toolCounts[c.name] = (toolCounts[c.name] ?? 0) + 1;
	const toolTimings = toolResults
		.filter((r) => typeof r.durationMs === 'number')
		.map((r) => ({ name: r.name, durationMs: r.durationMs ?? 0 }));
	const totalToolTimeMs = toolTimings.reduce(
		(a, b) => a + (b.durationMs ?? 0),
		0,
	);
	return { toolCounts, toolTimings, totalToolTimeMs } satisfies UsageAggregate;
}

export function collectDiffArtifacts(toolResults: ToolResultRecord[]) {
	return toolResults
		.filter((r) => r.artifact?.kind === 'file_diff')
		.map((r) => ({ name: r.name, summary: r.artifact?.summary }));
}

export function summarizeFilesTouched(
	toolResults: ToolResultRecord[],
): string[] {
	const set = new Set<string>();
	for (const r of toolResults) {
		if (
			r.artifact?.kind === 'file_diff' &&
			typeof r.artifact.patch === 'string'
		)
			for (const f of extractFilesFromPatch(r.artifact.patch)) set.add(f);
		const resultValue = r.result as { path?: unknown } | undefined;
		if (r.name === 'write' && typeof resultValue?.path === 'string')
			set.add(resultValue.path);
	}
	return Array.from(set);
}

export function mergeTokenUsage(
	usage: Record<string, unknown> | undefined,
	costUsd: unknown,
	finish: unknown,
): TokenUsageSummary | null {
	const usageInput = toNumberOrUndefined(usage?.inputTokens);
	const usageOutput = toNumberOrUndefined(usage?.outputTokens);
	const usageTotal = toNumberOrUndefined(usage?.totalTokens);
	const cost = toNumberOrUndefined(costUsd);
	const finishReason =
		typeof finish === 'string' && finish.trim().length
			? finish.trim()
			: undefined;
	if (
		usageInput == null &&
		usageOutput == null &&
		usageTotal == null &&
		cost == null &&
		!finishReason
	)
		return null;
	return {
		inputTokens: usageInput ?? undefined,
		outputTokens: usageOutput ?? undefined,
		totalTokens:
			usageTotal ??
			((usageInput ?? null) != null && (usageOutput ?? null) != null
				? (usageInput ?? 0) + (usageOutput ?? 0)
				: undefined),
		costUsd: cost ?? undefined,
		finishReason,
	};
}
