import { useKeyboard } from '@opentui/react';
import { useCallback, useEffect, useState } from 'react';
import { getAgents } from '@ottocode/api';
import { useTheme } from '../theme.ts';

interface AgentsOverlayProps {
	currentAgent: string;
	onClose: () => void;
	onSelect: (agent: string) => void | Promise<void>;
}

export function AgentsOverlay({
	currentAgent,
	onClose,
	onSelect,
}: AgentsOverlayProps) {
	const { colors } = useTheme();
	const [agents, setAgents] = useState<string[]>([]);
	const [selectedIdx, setSelectedIdx] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const response = await getAgents();
				if (cancelled) return;
				const list = response.data?.agents ?? [];
				setAgents(list);
				const idx = list.indexOf(currentAgent);
				setSelectedIdx(idx >= 0 ? idx : 0);
			} catch {
				if (!cancelled) setError('failed to load agents');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [currentAgent]);

	const navigate = useCallback((next: number) => {
		setSelectedIdx(next);
	}, []);

	useKeyboard((key) => {
		if (agents.length === 0) {
			if (key.name === 'escape') onClose();
			return;
		}
		if (key.name === 'up') {
			navigate(selectedIdx <= 0 ? agents.length - 1 : selectedIdx - 1);
		} else if (key.name === 'down') {
			navigate(selectedIdx >= agents.length - 1 ? 0 : selectedIdx + 1);
		} else if (key.name === 'return') {
			const choice = agents[selectedIdx];
			if (choice) void Promise.resolve(onSelect(choice)).then(onClose);
		} else if (key.name === 'escape') {
			onClose();
		}
	});

	return (
		<box
			style={{
				position: 'absolute',
				top: Math.floor((process.stdout.rows ?? 40) * 0.2),
				left: Math.floor((process.stdout.columns ?? 120) * 0.3),
				right: Math.floor((process.stdout.columns ?? 120) * 0.3),
				border: true,
				borderStyle: 'rounded',
				borderColor: colors.border,
				backgroundColor: colors.bg,
				zIndex: 100,
				flexDirection: 'column',
				padding: 1,
			}}
			title=" Agents "
		>
			{loading && <text fg={colors.fgDimmed}>loading…</text>}
			{error && <text fg={colors.red}>{error}</text>}
			{!loading && !error && agents.length === 0 && (
				<text fg={colors.fgDimmed}>no agents available</text>
			)}
			<box style={{ flexDirection: 'column' }}>
				{agents.map((agent, index) => {
					const isSelected = index === selectedIdx;
					const isCurrent = agent === currentAgent;
					return (
						<box
							key={agent}
							style={{
								flexDirection: 'row',
								gap: 1,
								backgroundColor: isSelected ? colors.bgHighlight : undefined,
								paddingLeft: 1,
								paddingRight: 1,
							}}
						>
							<text fg={isSelected ? colors.fgBright : colors.fgMuted}>
								{agent}
							</text>
							{isCurrent && <text fg={colors.green}>•</text>}
						</box>
					);
				})}
			</box>
			<box style={{ marginTop: 1 }}>
				<text fg={colors.fgDimmed}>↑↓ ↵ esc</text>
			</box>
		</box>
	);
}
