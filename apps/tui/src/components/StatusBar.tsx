import { useTheme } from '../theme.ts';

interface StatusBarProps {
	sessionTitle: string | null;
	queueSize?: number;
	contextTokens?: number;
	estimatedCost?: number;
	contextUsagePercent?: number;
}

function formatCompact(num: number): string {
	if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
	if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
	return num.toString();
}

export function StatusBar({
	sessionTitle,
	queueSize = 0,
	contextTokens = 0,
	estimatedCost = 0,
	contextUsagePercent = 0,
}: StatusBarProps) {
	const { colors } = useTheme();
	const title = sessionTitle || 'new session';

	const contextColor =
		contextUsagePercent >= 90
			? colors.red
			: contextUsagePercent >= 70
				? colors.yellow
				: colors.fgDimmed;

	return (
		<box
			style={{
				width: '100%',
				flexShrink: 0,
				backgroundColor: colors.bgDark,
				flexDirection: 'row',
				paddingLeft: 1,
				paddingRight: 1,
				gap: 1,
			}}
		>
			<text fg={colors.blue}>
				<b> otto </b>
			</text>
			<text fg={colors.fgDimmed}>│</text>
			<text fg={sessionTitle ? colors.fg : colors.fgDark}>{title}</text>
			{queueSize > 0 && <text fg={colors.yellow}>({queueSize} queued)</text>}

			<box style={{ flexGrow: 1 }} />

			{contextTokens > 0 && (
				<>
					<text fg={colors.fgDimmed}>ctx </text>
					<text fg={contextColor}>{formatCompact(contextTokens)}</text>
				</>
			)}
			{estimatedCost > 0 && (
				<>
					<text fg={colors.fgDimmed}> │ </text>
					<text fg={colors.fg}>${estimatedCost.toFixed(4)}</text>
				</>
			)}
		</box>
	);
}
