import { memo } from 'react';
import { useTheme } from '../theme.ts';
import { DiffView } from './DiffView.tsx';
import type { MessagePart } from '../types.ts';

const DIFF_TOOLS = new Set(['write', 'edit', 'multiedit', 'apply_patch']);

function isShellTool(toolName?: string | null): boolean {
	return toolName === 'shell' || toolName === 'bash';
}

interface ToolCallItemProps {
	part: MessagePart;
	isLast: boolean;
	isFirst?: boolean;
}

function getTarget(part: MessagePart): string | null {
	const cj = part.contentJson as Record<string, unknown> | undefined;
	if (!cj) return null;

	const args = cj.args as Record<string, unknown> | undefined;
	const source = args || cj;

	if (isShellTool(part.toolName)) {
		const cmd = source.cmd || source.command;
		if (typeof cmd === 'string') {
			const trimmed = cmd.trim();
			return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
		}
	}

	for (const key of ['path', 'filePath', 'file', 'pattern', 'query', 'url']) {
		const val = source[key];
		if (typeof val === 'string' && val.trim()) {
			const trimmed = val.trim();
			return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed;
		}
	}

	return null;
}

function extractDiffPatch(part: MessagePart): string | null {
	if (!DIFF_TOOLS.has(part.toolName || '')) return null;
	if (part.type !== 'tool_result' && !part.completedAt) return null;

	const cj = part.contentJson as Record<string, unknown> | undefined;
	if (!cj) return null;

	const artifact = cj.artifact as { kind?: string; patch?: string } | undefined;
	if (artifact?.kind === 'file_diff' && typeof artifact.patch === 'string') {
		return artifact.patch;
	}

	const result = cj.result as
		| { artifact?: { kind?: string; patch?: string } }
		| undefined;
	if (
		result?.artifact?.kind === 'file_diff' &&
		typeof result.artifact.patch === 'string'
	) {
		return result.artifact.patch;
	}

	return null;
}

function extractFilePath(part: MessagePart): string | undefined {
	const cj = part.contentJson as Record<string, unknown> | undefined;
	if (!cj) return undefined;

	const args = cj.args as Record<string, unknown> | undefined;
	const result = cj.result as Record<string, unknown> | undefined;

	for (const src of [args, result, cj]) {
		if (!src) continue;
		for (const key of ['path', 'filePath', 'file']) {
			const val = src[key];
			if (typeof val === 'string' && val.trim()) return val.trim();
		}
	}

	return undefined;
}

function extractToolError(part: MessagePart): string | null {
	if (part.type === 'error') return null;
	const cj = part.contentJson as Record<string, unknown> | undefined;
	if (!cj) return null;

	if (typeof cj.error === 'string') return cj.error;

	const result = cj.result as Record<string, unknown> | undefined;
	if (
		result &&
		typeof result === 'object' &&
		'ok' in result &&
		result.ok === false
	) {
		if (typeof result.error === 'string') return result.error;
		return 'Tool execution failed';
	}

	return null;
}

export const ToolCallItem = memo(function ToolCallItem({
	part,
	isLast: _isLast,
	isFirst,
}: ToolCallItemProps) {
	const { colors } = useTheme();
	const toolName = part.toolName || 'unknown';
	const target = getTarget(part);
	const isResult = part.type === 'tool_result';
	const isCompleted = isResult || !!part.completedAt;
	const toolError = extractToolError(part);
	const hasError = part.type === 'error' || !!toolError;
	const duration = part.toolDurationMs;
	const displayName = toolName.includes('__')
		? toolName.replace('__', ' > ')
		: toolName;

	const icon = hasError ? '✗' : isCompleted ? '✓' : '→';
	const iconColor = hasError
		? colors.red
		: isCompleted
			? colors.green
			: colors.fgDark;
	const nameColor = hasError
		? colors.red
		: isCompleted
			? colors.fgMuted
			: colors.fgDark;

	const durationStr = duration
		? duration < 1000
			? `${duration}ms`
			: `${(duration / 1000).toFixed(1)}s`
		: '';

	const maxErrorLen = Math.max(20, 60 - displayName.length);
	const truncatedError =
		hasError && toolError
			? toolError.length > maxErrorLen
				? `${toolError.slice(0, maxErrorLen - 1)}…`
				: toolError
			: '';

	const diffPatch = extractDiffPatch(part);
	const filePath = extractFilePath(part);

	return (
		<box
			style={{
				flexDirection: 'column',
				width: '100%',
				marginTop: isFirst ? 1 : 0,
			}}
		>
			<box
				style={{
					flexDirection: 'row',
					gap: 1,
					paddingLeft: 2,
					height: 1,
					width: '100%',
					backgroundColor: colors.toolBg,
					overflow: 'hidden',
				}}
			>
				<text style={{ flexShrink: 0 }} fg={iconColor}>
					{icon}
				</text>
				<text style={{ flexShrink: 0 }} fg={nameColor}>
					{displayName}
				</text>
				{hasError && truncatedError ? (
					<text style={{ flexShrink: 0 }} fg={colors.red}>
						{truncatedError}
					</text>
				) : null}
				{hasError && durationStr ? (
					<text style={{ flexShrink: 0 }} fg={colors.fgDimmed}>
						{durationStr}
					</text>
				) : null}
				{!hasError && target && (
					<text
						style={{ flexShrink: 1, overflow: 'hidden' }}
						fg={colors.toolArgs}
					>
						{target}
					</text>
				)}
				{!hasError && durationStr ? (
					<text style={{ flexShrink: 0 }} fg={colors.fgDimmed}>
						{durationStr}
					</text>
				) : null}
			</box>
			{diffPatch && <DiffView patch={diffPatch} filePath={filePath} />}
		</box>
	);
});
