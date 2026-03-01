import { colors } from '../theme.ts';
import type { MessagePart } from '../types.ts';

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

export function ToolCallItem({ part, isLast, isFirst }: ToolCallItemProps) {
	const toolName = part.toolName || 'unknown';
	const target = getTarget(part);
	const isResult = part.type === 'tool_result';
	const isCompleted = isResult || !!part.completedAt;
	const hasError = part.type === 'error';
	const duration = part.toolDurationMs;
	const displayName = toolName.includes('__') ? toolName.replace('__', ' > ') : toolName;

	const icon = hasError ? 'x' : isCompleted ? '✓' : '→';
	const iconColor = hasError ? colors.red : isCompleted ? colors.green : colors.fgDark;
	const nameColor = isCompleted ? colors.fgMuted : colors.fgDark;

	return (
		<box
			style={{
				flexDirection: 'row',
				gap: 1,
				paddingLeft: 2,
				height: 1,
				width: '100%',
				backgroundColor: colors.toolBg,
				marginTop: isFirst ? 1 : 0,
			}}
		>
			<text fg={iconColor}>{icon}</text>
			<text fg={nameColor}>{displayName}</text>
			{target && <text fg={colors.toolArgs}>{target}</text>}
			{duration ? (
				<text fg={colors.fgDimmed}>
					{duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
				</text>
			) : null}
		</box>
	);
}
