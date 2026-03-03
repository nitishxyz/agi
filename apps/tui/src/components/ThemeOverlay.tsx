import { useKeyboard } from '@opentui/react';
import { useState, useRef, useCallback } from 'react';
import { useTheme, themeList } from '../theme.ts';

interface ThemeOverlayProps {
	onClose: () => void;
	onSave: (name: string) => void;
}

export function ThemeOverlay({ onClose, onSave }: ThemeOverlayProps) {
	const { colors, themeName, setTheme } = useTheme();
	const originalThemeRef = useRef(themeName);
	const [selectedIdx, setSelectedIdx] = useState(
		Math.max(
			0,
			themeList.findIndex((t) => t.name === themeName),
		),
	);

	const navigate = useCallback(
		(next: number) => {
			setSelectedIdx(next);
			setTheme(themeList[next].name);
		},
		[setTheme],
	);

	useKeyboard((key) => {
		if (key.name === 'up') {
			const next = selectedIdx <= 0 ? themeList.length - 1 : selectedIdx - 1;
			navigate(next);
		} else if (key.name === 'down') {
			const next = selectedIdx >= themeList.length - 1 ? 0 : selectedIdx + 1;
			navigate(next);
		} else if (key.name === 'return') {
			onSave(themeList[selectedIdx].name);
			onClose();
		} else if (key.name === 'escape') {
			setTheme(originalThemeRef.current);
			onClose();
		}
	});

	return (
		<box
			style={{
				position: 'absolute',
				top: Math.floor((process.stdout.rows ?? 40) * 0.15),
				left: Math.floor((process.stdout.columns ?? 120) * 0.2),
				right: Math.floor((process.stdout.columns ?? 120) * 0.2),
				border: true,
				borderStyle: 'rounded',
				borderColor: colors.border,
				backgroundColor: colors.bg,
				zIndex: 100,
				flexDirection: 'column',
				padding: 1,
			}}
			title=" Theme "
		>
			<text fg={colors.blue}>
				<b>Select Theme</b>
			</text>
			<box style={{ flexDirection: 'column', marginTop: 1, gap: 0 }}>
				{themeList.map((t, i) => {
					const isSelected = i === selectedIdx;
					const isCurrent = t.name === themeName;
					return (
						<box
							key={t.name}
							style={{
								flexDirection: 'row',
								gap: 1,
								height: 1,
								width: '100%',
								backgroundColor: isSelected ? colors.bgHighlight : undefined,
								paddingLeft: 1,
							}}
						>
							<text fg={isSelected ? colors.fgBright : colors.fgMuted}>
								{t.displayName}
							</text>
							{isCurrent && <text fg={colors.fgDark}>(current)</text>}
							<box style={{ flexDirection: 'row', gap: 0 }}>
								<text fg={t.colors.red}>●</text>
								<text fg={t.colors.green}>●</text>
								<text fg={t.colors.blue}>●</text>
								<text fg={t.colors.yellow}>●</text>
								<text fg={t.colors.purple}>●</text>
							</box>
						</box>
					);
				})}
			</box>
			<text fg={colors.fgDimmed}>↑↓ preview · ↵ confirm · esc cancel</text>
		</box>
	);
}
