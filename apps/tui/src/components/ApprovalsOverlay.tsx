import { useKeyboard } from '@opentui/react';
import { useCallback, useState } from 'react';
import { useTheme } from '../theme.ts';

const APPROVAL_OPTIONS = [
	{
		id: 'auto',
		label: 'Auto',
		description: 'Run normally, but guarded risky commands can still ask.',
	},
	{
		id: 'dangerous',
		label: 'Dangerous only',
		description: 'Ask before dangerous tools and risky changes.',
	},
	{
		id: 'yolo',
		label: 'YOLO',
		description: 'Never ask unless a hard safety block prevents the command.',
	},
	{
		id: 'all',
		label: 'All tools',
		description: 'Ask before every tool call.',
	},
] as const;

type ApprovalMode = (typeof APPROVAL_OPTIONS)[number]['id'];

interface ApprovalsOverlayProps {
	currentMode: ApprovalMode;
	onClose: () => void;
	onSave: (mode: ApprovalMode) => void | Promise<void>;
}

export function ApprovalsOverlay({
	currentMode,
	onClose,
	onSave,
}: ApprovalsOverlayProps) {
	const { colors } = useTheme();
	const [selectedIdx, setSelectedIdx] = useState(
		Math.max(
			0,
			APPROVAL_OPTIONS.findIndex((option) => option.id === currentMode),
		),
	);

	const navigate = useCallback((next: number) => {
		setSelectedIdx(next);
	}, []);

	useKeyboard((key) => {
		if (key.name === 'up') {
			const next =
				selectedIdx <= 0 ? APPROVAL_OPTIONS.length - 1 : selectedIdx - 1;
			navigate(next);
		} else if (key.name === 'down') {
			const next =
				selectedIdx >= APPROVAL_OPTIONS.length - 1 ? 0 : selectedIdx + 1;
			navigate(next);
		} else if (key.name === 'return') {
			void Promise.resolve(onSave(APPROVAL_OPTIONS[selectedIdx].id)).then(
				onClose,
			);
		} else if (key.name === 'escape') {
			onClose();
		}
	});

	return (
		<box
			style={{
				position: 'absolute',
				top: Math.floor((process.stdout.rows ?? 40) * 0.16),
				left: Math.floor((process.stdout.columns ?? 120) * 0.18),
				right: Math.floor((process.stdout.columns ?? 120) * 0.18),
				border: true,
				borderStyle: 'rounded',
				borderColor: colors.border,
				backgroundColor: colors.bg,
				zIndex: 100,
				flexDirection: 'column',
				padding: 1,
				gap: 1,
			}}
			title=" Tool approvals "
		>
			<text fg={colors.blue}>
				<b>Select approval mode</b>
			</text>
			<text fg={colors.fgMuted}>
				YOLO skips prompts but still blocks catastrophic commands like rm -rf /
			</text>
			<box style={{ flexDirection: 'column', gap: 0 }}>
				{APPROVAL_OPTIONS.map((option, index) => {
					const isSelected = index === selectedIdx;
					const isCurrent = option.id === currentMode;
					return (
						<box
							key={option.id}
							style={{
								flexDirection: 'column',
								backgroundColor: isSelected ? colors.bgHighlight : undefined,
								paddingLeft: 1,
								paddingRight: 1,
								paddingTop: 0,
								paddingBottom: 0,
							}}
						>
							<box style={{ flexDirection: 'row', gap: 1 }}>
								<text fg={isSelected ? colors.fgBright : colors.fgMuted}>
									{option.label}
								</text>
								<text fg={colors.fgDark}>({option.id})</text>
								{isCurrent && <text fg={colors.green}>current</text>}
							</box>
							<text fg={isSelected ? colors.fg : colors.fgDimmed}>
								{option.description}
							</text>
						</box>
					);
				})}
			</box>
			<text fg={colors.fgDimmed}>↑↓ move · ↵ save · esc close</text>
		</box>
	);
}
