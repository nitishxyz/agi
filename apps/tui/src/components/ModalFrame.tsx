import { useTerminalDimensions } from '@opentui/react';
import type { ReactNode } from 'react';
import { useTheme } from '../theme.ts';

interface ModalFrameProps {
	title: string;
	children: ReactNode;
	footer?: ReactNode;
	preferredWidth?: number;
	maxWidth?: number;
	minWidth?: number;
	contentHeight?: number;
	maxHeightRatio?: number;
	padding?: number;
	gap?: number;
	showHeader?: boolean;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * OpenCode-inspired modal shell: a fullscreen dim backdrop with a centered
 * panel, plain header row, content body, and compact footer help.
 */
export function ModalFrame({
	title,
	children,
	footer,
	preferredWidth = 96,
	maxWidth = 112,
	minWidth = 34,
	contentHeight,
	maxHeightRatio = 0.74,
	padding = 1,
	gap = 1,
	showHeader = true,
}: ModalFrameProps) {
	const { colors } = useTheme();
	const { width: terminalWidth, height: terminalHeight } =
		useTerminalDimensions();
	const safeWidth = terminalWidth || (process.stdout.columns ?? 120);
	const safeHeight = terminalHeight || (process.stdout.rows ?? 40);
	const horizontalMargin = safeWidth < 70 ? 1 : 4;
	const verticalMargin = safeHeight < 24 ? 1 : 2;
	const availableWidth = Math.max(20, safeWidth - horizontalMargin * 2);
	const width = clamp(
		Math.min(preferredWidth, maxWidth),
		Math.min(minWidth, availableWidth),
		availableWidth,
	);
	const maxHeight = Math.max(
		12,
		Math.floor(safeHeight * maxHeightRatio) - verticalMargin,
	);
	const defaultHeight = Math.floor(safeHeight * maxHeightRatio);
	const height = clamp(
		contentHeight ?? defaultHeight,
		Math.min(18, maxHeight),
		Math.min(maxHeight, safeHeight - verticalMargin * 2),
	);
	const topPadding = Math.max(1, Math.floor((safeHeight - height) / 2));

	return (
		<box
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				width: safeWidth,
				height: safeHeight,
				zIndex: 3000,
				backgroundColor: colors.bgDark,
				alignItems: 'center',
				paddingTop: topPadding,
			}}
		>
			<box
				style={{
					width,
					height,
					maxHeight,
					backgroundColor: colors.bg,
					flexDirection: 'column',
					paddingTop: 1,
					paddingBottom: padding,
					gap,
				}}
			>
				{showHeader && (
					<box
						style={{
							paddingLeft: 4,
							paddingRight: 4,
							flexDirection: 'row',
							justifyContent: 'space-between',
							height: 1,
							flexShrink: 0,
						}}
					>
						<text fg={colors.fgBright}>
							<b>{title}</b>
						</text>
						<text fg={colors.fgDark}>esc</text>
					</box>
				)}
				<box
					style={{
						flexDirection: 'column',
						flexGrow: 1,
						flexShrink: 1,
						paddingLeft: padding,
						paddingRight: padding,
					}}
				>
					{children}
				</box>
				{footer && (
					<box
						style={{
							height: 1,
							flexShrink: 0,
							paddingLeft: 4,
							paddingRight: 2,
						}}
					>
						<text fg={colors.fgDimmed}>{footer}</text>
					</box>
				)}
			</box>
		</box>
	);
}

export function SelectRow({
	active,
	current,
	title,
	description,
	footer,
	gutter,
}: {
	active: boolean;
	current?: boolean;
	title: ReactNode;
	description?: ReactNode;
	footer?: ReactNode;
	gutter?: ReactNode;
}) {
	const { colors } = useTheme();
	const selectedFg = colors.bg;

	return (
		<box
			style={{
				flexDirection: 'column',
				height: 1,
				width: '100%',
				backgroundColor: active ? colors.blue : undefined,
			}}
		>
			<box
				style={{
					flexDirection: 'row',
					gap: 1,
					paddingLeft: current || gutter ? 1 : 3,
					paddingRight: 3,
					width: '100%',
				}}
			>
				{current && <text fg={active ? selectedFg : colors.blue}>●</text>}
				{!current && gutter}
				<text fg={active ? selectedFg : current ? colors.blue : colors.fg}>
					{active ? <b>{title}</b> : title}
				</text>
				{description && (
					<text fg={active ? selectedFg : colors.fgDark}>{description}</text>
				)}
				{footer && (
					<box style={{ flexShrink: 0 }}>
						{typeof footer === 'string' ? (
							<text fg={active ? selectedFg : colors.fgDark}>{footer}</text>
						) : (
							footer
						)}
					</box>
				)}
			</box>
		</box>
	);
}

export function getVisibleWindow(
	total: number,
	selectedIndex: number,
	maxVisible: number,
): { start: number; end: number } {
	if (total <= maxVisible) return { start: 0, end: total };
	const half = Math.floor(maxVisible / 2);
	const start = clamp(selectedIndex - half, 0, total - maxVisible);
	return { start, end: start + maxVisible };
}
