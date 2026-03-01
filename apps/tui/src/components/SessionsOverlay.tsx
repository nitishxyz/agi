import { useKeyboard, useRenderer } from '@opentui/react';
import { useState, useEffect } from 'react';
import { colors } from '../theme.ts';
import type { Session } from '../types.ts';

interface SessionsOverlayProps {
	sessions: Session[];
	onSelect: (session: Session) => void;
	onClose: () => void;
}

function timeAgo(ts: number | null): string {
	if (!ts) return '';
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

const ITEM_HEIGHT = 2;

export function SessionsOverlay({ sessions, onSelect, onClose }: SessionsOverlayProps) {
	const [selectedIdx, setSelectedIdx] = useState(0);
	const renderer = useRenderer();

	useKeyboard((key) => {
		if (key.name === 'up') {
			setSelectedIdx((prev) => (prev <= 0 ? sessions.length - 1 : prev - 1));
		} else if (key.name === 'down') {
			setSelectedIdx((prev) => (prev >= sessions.length - 1 ? 0 : prev + 1));
		} else if (key.name === 'return') {
			if (sessions.length > 0 && selectedIdx >= 0 && selectedIdx < sessions.length) {
				onSelect(sessions[selectedIdx]);
			}
		} else if (key.name === 'escape') {
			onClose();
		}
	});

	useEffect(() => {
		const scrollbox = renderer.root.findDescendantById('sessions-scrollbox');
		if (scrollbox && 'scrollTo' in scrollbox) {
			(scrollbox as { scrollTo: (pos: number) => void }).scrollTo(selectedIdx * ITEM_HEIGHT);
		}
	}, [selectedIdx, renderer]);

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
			}}
			title=" Sessions "
		>
			{sessions.length === 0 ? (
				<text fg={colors.fgDark}>No sessions yet. Type /new to create one.</text>
			) : (
				<scrollbox
					id="sessions-scrollbox"
					style={{
						flexGrow: 1,
						width: '100%',
						flexDirection: 'column',
					}}
				>
					{sessions.map((s, i) => {
						const isSelected = i === selectedIdx;
						const title = s.title || 'untitled';
						const meta = `${s.provider || 'unknown'}/${s.model || ''} · ${timeAgo(s.lastActiveAt)}`;
						return (
							<box
								key={s.id}
								style={{
									flexDirection: 'column',
									width: '100%',
									backgroundColor: isSelected ? colors.bgHighlight : undefined,
									paddingLeft: 1,
									paddingRight: 1,
									height: ITEM_HEIGHT,
								}}
							>
								<text fg={isSelected ? colors.fgBright : colors.fgMuted}>{title}</text>
								<text fg={isSelected ? colors.fgDimmed : colors.fgDark}>{meta}</text>
							</box>
						);
					})}
				</scrollbox>
			)}
			<box style={{ height: 1, flexShrink: 0 }}>
				<text fg={colors.fgDimmed}>↑↓ navigate  enter select  esc close</text>
			</box>
		</box>
	);
}
