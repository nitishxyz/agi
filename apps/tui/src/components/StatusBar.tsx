import { useTheme } from '../theme.ts';

interface StatusBarProps {
	sessionTitle: string | null;
	queueSize?: number;
}

export function StatusBar({ sessionTitle, queueSize = 0 }: StatusBarProps) {
	const { colors } = useTheme();
	const title = sessionTitle || 'new session';

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
			{queueSize > 0 && (
				<text fg={colors.yellow}>({queueSize} queued)</text>
			)}
		</box>
	);
}
