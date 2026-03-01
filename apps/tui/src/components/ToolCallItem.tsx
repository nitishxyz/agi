import { useTheme } from '../theme.ts';
import { DiffView } from './DiffView.tsx';
import type { MessagePart } from '../types.ts';

const DIFF_TOOLS = new Set(['write', 'edit', 'apply_patch']);

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

	if (part.toolName === 'bash') {
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

export function ToolCallItem({ part, _isLast, isFirst }: ToolCallItemProps) {
	const { colors } = useTheme();
	const toolName = part.toolName || 'unknown';
	const target = getTarget(part);
	const isResult = part.type === 'tool_result';
	const isCompleted = isResult || !!part.completedAt;
	const hasError = part.type === 'error';
	const duration = part.toolDurationMs;
	const displayName = toolName.includes('__')
		? toolName.replace('__', ' > ')
		: toolName;

	const icon = hasError ? 'x' : isCompleted ? '✓' : '→';
	const iconColor = hasError
		? colors.red
		: isCompleted
			? colors.green
			: colors.fgDark;
	const nameColor = isCompleted ? colors.fgMuted : colors.fgDark;

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
				{target && (
					<text
						style={{ flexShrink: 1, overflow: 'hidden' }}
						fg={colors.toolArgs}
					>
						{target}
					</text>
				)}
				{duration ? (
					<text style={{ flexShrink: 0 }} fg={colors.fgDimmed}>
						{duration < 1000
							? `${duration}ms`
							: `${(duration / 1000).toFixed(1)}s`}
					</text>
				) : null}
			</box>
			{diffPatch && <DiffView patch={diffPatch} filePath={filePath} />}
		</box>
	);
}
