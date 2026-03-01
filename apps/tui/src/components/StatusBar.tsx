import { colors } from '../theme.ts';

interface StatusBarProps {
	provider: string;
	model: string;
	sessionTitle: string | null;
	isStreaming: boolean;
}

function truncateModel(model: string, max: number): string {
	if (model.length <= max) return model;
	const parts = model.split('-');
	if (parts.length > 2) {
		const short = parts.slice(0, 2).join('-');
		return short.length <= max ? short : `${model.slice(0, max - 1)}…`;
	}
	return `${model.slice(0, max - 1)}…`;
}

export function StatusBar({ provider, model, sessionTitle, isStreaming }: StatusBarProps) {
	const title = sessionTitle || 'new session';
	const modelShort = truncateModel(model, 28);

	return (
		<box
			style={{
				width: '100%',
				height: 1,
				flexShrink: 0,
				backgroundColor: colors.bgDark,
				flexDirection: 'row',
				paddingLeft: 1,
				paddingRight: 1,
				gap: 0,
			}}
		>
			<text fg={colors.blue}>
				<b> otto </b>
			</text>
			<text fg={colors.fgDimmed}> │ </text>
			<text fg={colors.fgDark}>{provider}</text>
			<text fg={colors.fgDimmed}>/</text>
			<text fg={colors.fgMuted}>{modelShort}</text>
			<text fg={colors.fgDimmed}> │ </text>
			<text fg={sessionTitle ? colors.fg : colors.fgDark}>{title}</text>
			{isStreaming && (
				<text fg={colors.streamDot}> ● generating</text>
			)}
		</box>
	);
}
