import { colors } from '../theme.ts';

interface ConfigOverlayProps {
	providers: string[];
	agents: string[];
	currentProvider: string;
	currentModel: string;
	currentAgent: string;
	onClose: () => void;
	onUpdate: (changes: { provider?: string; model?: string; agent?: string }) => void;
}

export function ConfigOverlay({
	providers,
	agents,
	currentProvider,
	currentModel,
	currentAgent,
	onClose,
	onUpdate,
}: ConfigOverlayProps) {
	return (
		<box
			style={{
				position: 'absolute',
				top: 2,
				left: 2,
				right: 2,
				bottom: 2,
				border: true,
				borderStyle: 'rounded',
				borderColor: colors.border,
				backgroundColor: colors.bg,
				zIndex: 100,
				flexDirection: 'column',
				padding: 1,
				gap: 0,
			}}
			title=" Configuration "
		>
			<box style={{ flexDirection: 'row', gap: 1 }}>
				<text fg={colors.fgDark}>provider</text>
				<text fg={colors.fg}>
					<b>{currentProvider}</b>
				</text>
			</box>
			<box style={{ flexDirection: 'row', gap: 1 }}>
				<text fg={colors.fgDark}>model</text>
				<text fg={colors.fg}>
					<b>{currentModel}</b>
				</text>
			</box>
			<box style={{ flexDirection: 'row', gap: 1 }}>
				<text fg={colors.fgDark}>agent</text>
				<text fg={colors.fg}>
					<b>{currentAgent}</b>
				</text>
			</box>
			{providers.length > 0 && (
				<box style={{ marginTop: 1, flexDirection: 'column' }}>
					<text fg={colors.fgDark}>available providers:</text>
					<text fg={colors.fgMuted}>  {providers.join(', ')}</text>
				</box>
			)}
			{agents.length > 0 && (
				<box style={{ flexDirection: 'column' }}>
					<text fg={colors.fgDark}>available agents:</text>
					<text fg={colors.fgMuted}>  {agents.join(', ')}</text>
				</box>
			)}
			<box style={{ marginTop: 1 }}>
				<text fg={colors.fgDimmed}>Use /provider, /model, /agent to change  esc close</text>
			</box>
		</box>
	);
}
