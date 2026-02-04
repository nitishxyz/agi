import type { Artifact } from '@agi-cli/sdk';
import {
	renderToolCall as _renderToolCall,
	renderToolResult as _renderToolResult,
	renderSummary as _renderSummary,
	c,
	ICONS,
} from './renderers/index.ts';
import type {
	ToolResultRecord,
	ToolCallRecord,
	TokenUsageSummary,
} from './types.ts';

export const dim = c.dim;
export const bold = c.bold;

export function printToolCall(
	toolName: string,
	args: unknown,
	_opts: { verbose?: boolean } = {},
): void {
	const output = _renderToolCall({ toolName, args });
	if (output) Bun.write(Bun.stderr, `\n${output}\n`);
}

export function logToolError(
	toolName: string,
	errorMessage: string,
	opts: { durationMs?: number } = {},
): void {
	const output = _renderToolResult({
		toolName,
		error: errorMessage,
		durationMs: opts.durationMs,
	});
	if (output) Bun.write(Bun.stderr, `${output}\n`);
}

export function printPlan(items: unknown, note?: string): void {
	const output = _renderToolResult({
		toolName: 'update_todos',
		result: { items, note },
	});
	if (output) Bun.write(Bun.stderr, `${output}\n`);
}

export function printSummary(
	toolCalls: ToolCallRecord[],
	toolResults: ToolResultRecord[],
	filesTouched: Set<string> | string[],
	tokenUsage?: TokenUsageSummary | null,
): void {
	const output = _renderSummary(
		toolCalls,
		toolResults,
		filesTouched,
		tokenUsage,
	);
	if (output) Bun.write(Bun.stderr, `${output}\n`);
}

export function printToolResult(
	toolName: string,
	result: unknown,
	artifact?: Artifact | { kind?: string; patch?: string },
	opts: {
		verbose?: boolean;
		durationMs?: number;
		error?: string;
		args?: unknown;
	} = {},
): void {
	const output = _renderToolResult({
		toolName,
		args: opts.args,
		result,
		artifact: artifact as Artifact,
		durationMs: opts.durationMs,
		error: opts.error,
		verbose: opts.verbose,
	});
	if (output) Bun.write(Bun.stderr, `${output}\n`);
}
