import { c, ICONS, formatMs } from './theme.ts';
import type {
	ToolCallRecord,
	ToolResultRecord,
	TokenUsageSummary,
} from '../types.ts';

export function renderSummary(
	toolCalls: ToolCallRecord[],
	_toolResults: ToolResultRecord[],
	filesTouched: Set<string> | string[],
	tokenUsage?: TokenUsageSummary | null,
): string {
	const filesArray = Array.isArray(filesTouched)
		? filesTouched
		: Array.from(filesTouched);
	if (toolCalls.length === 0 && filesArray.length === 0 && !tokenUsage)
		return '';

	const lines: string[] = [];
	lines.push('');
	lines.push(c.fgDimmed('─'.repeat(40)));

	if (toolCalls.length > 0) {
		const counts = new Map<string, number>();
		for (const call of toolCalls) {
			counts.set(call.name, (counts.get(call.name) || 0) + 1);
		}
		const parts = Array.from(counts.entries()).map(
			([name, count]) => `${name}×${count}`,
		);
		lines.push(`  ${c.fgDark('tools')}  ${c.fgDark(parts.join('  '))}`);
	}

	if (filesArray.length > 0) {
		const display = filesArray.slice(0, 5);
		lines.push(
			`  ${c.fgDark('files')}  ${c.fgDark(display.join(', '))}${filesArray.length > 5 ? c.fgDark(` +${filesArray.length - 5}`) : ''}`,
		);
	}

	if (tokenUsage) {
		const parts: string[] = [];
		if (tokenUsage.inputTokens !== undefined)
			parts.push(`in:${tokenUsage.inputTokens.toLocaleString()}`);
		if (tokenUsage.outputTokens !== undefined)
			parts.push(`out:${tokenUsage.outputTokens.toLocaleString()}`);
		if (tokenUsage.costUsd !== undefined)
			parts.push(`$${tokenUsage.costUsd.toFixed(4)}`);
		if (parts.length > 0) {
			lines.push(`  ${c.fgDark('usage')}  ${c.fgDark(parts.join('  '))}`);
		}
	}

	lines.push('');
	return lines.join('\n');
}

export function renderContextHeader(opts: {
	agent: string;
	provider: string;
	model: string;
}): string {
	return `${c.purple(ICONS.star)} ${c.purpleBold(opts.agent)} ${c.fgDark(ICONS.dot)} ${c.fgMuted(opts.provider)} ${c.fgDark(ICONS.dot)} ${c.fgDimmed(opts.model)}`;
}

export function renderSessionInfo(
	kind: 'created' | 'last',
	sessionId: string,
): string {
	const label = kind === 'created' ? 'new session' : 'session';
	return c.fgDark(`${label} ${sessionId}`);
}

export function renderDoneMessage(elapsedMs: number): string {
	return c.fgDark(`done ${formatMs(elapsedMs)}`);
}
