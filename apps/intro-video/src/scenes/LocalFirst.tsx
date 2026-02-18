import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
	spring,
} from 'remotion';
import { colors, font } from '../theme';

const ITEMS = [
	{
		icon: 'terminal',
		title: 'Runs on your machine',
		desc: 'No cloud IDE. Otto lives in your terminal.',
	},
	{
		icon: 'database',
		title: 'Local config and state',
		desc: 'SQLite database, .otto/ project overrides.',
	},
	{
		icon: 'plug',
		title: 'You pick the provider',
		desc: 'Your API keys, your models, your choice.',
	},
];

const TerminalIcon: React.FC<{ size: number; color: string }> = ({
	size,
	color,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polyline points="4 17 10 11 4 5" />
		<line x1="12" x2="20" y1="19" y2="19" />
	</svg>
);

const DatabaseIcon: React.FC<{ size: number; color: string }> = ({
	size,
	color,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<ellipse cx="12" cy="5" rx="9" ry="3" />
		<path d="M3 5V19A9 3 0 0 0 21 19V5" />
		<path d="M3 12A9 3 0 0 0 21 12" />
	</svg>
);

const PlugIcon: React.FC<{ size: number; color: string }> = ({
	size,
	color,
}) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke={color}
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M12 22v-5" />
		<path d="M9 8V2" />
		<path d="M15 8V2" />
		<path d="M18 8v5a6 6 0 0 1-12 0V8z" />
	</svg>
);

const ItemIcon: React.FC<{ type: string; size: number; color: string }> = ({
	type,
	size,
	color,
}) => {
	switch (type) {
		case 'terminal':
			return <TerminalIcon size={size} color={color} />;
		case 'database':
			return <DatabaseIcon size={size} color={color} />;
		case 'plug':
			return <PlugIcon size={size} color={color} />;
		default:
			return null;
	}
};

export const LocalFirst: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const titleProgress = spring({
		frame: frame - 5,
		fps,
		config: { damping: 16, mass: 0.9, stiffness: 80 },
	});
	const titleY = interpolate(titleProgress, [0, 1], [50, 0]);

	const floatY = Math.sin(frame * 0.03) * 3;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: colors.bg,
				justifyContent: 'center',
				alignItems: 'center',
				fontFamily: font.sans,
			}}
		>
			<div
				style={{
					position: 'absolute',
					width: 600,
					height: 800,
					background: `radial-gradient(ellipse 60% 50% at 30% 50%, ${colors.accent}0A, transparent)`,
					filter: 'blur(60px)',
				}}
			/>

			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 100,
					transform: `translateY(${floatY}px)`,
					maxWidth: 1400,
					padding: '0 80px',
				}}
			>
				<div
					style={{
						flex: '0 0 480px',
						opacity: titleProgress,
						transform: `translateY(${titleY}px)`,
					}}
				>
					<div
						style={{
							fontSize: 18,
							color: colors.dim,
							letterSpacing: '0.3em',
							textTransform: 'uppercase' as const,
							marginBottom: 20,
							fontFamily: font.mono,
							fontWeight: 500,
						}}
					>
						How it works
					</div>
					<div
						style={{
							fontSize: 72,
							fontWeight: 700,
							color: colors.text,
							letterSpacing: '-0.03em',
							lineHeight: 1.05,
						}}
					>
						Runs where
						<br />
						you do.
					</div>
				</div>

				<div
					style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}
				>
					{ITEMS.map((item, i) => {
						const delay = 20 + i * 18;
						const progress = spring({
							frame: frame - delay,
							fps,
							config: { damping: 14, mass: 0.7, stiffness: 140 },
						});
						const x = interpolate(progress, [0, 1], [120, 0]);

						return (
							<div
								key={item.title}
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: 28,
									opacity: progress,
									transform: `translateX(${x}px)`,
									background: `linear-gradient(145deg, ${colors.surface}, ${colors.card})`,
									border: `1px solid ${colors.border}`,
									borderRadius: 22,
									padding: '28px 32px',
									boxShadow:
										'0 4px 24px rgba(0,0,0,0.03), 0 1px 6px rgba(0,0,0,0.02)',
								}}
							>
								<div
									style={{
										flex: '0 0 64px',
										width: 64,
										height: 64,
										borderRadius: 18,
										background: `linear-gradient(135deg, ${colors.accent}12, ${colors.accent}06)`,
										border: `1px solid ${colors.accent}18`,
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
									}}
								>
									<ItemIcon type={item.icon} size={30} color={colors.accent} />
								</div>
								<div
									style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
								>
									<span
										style={{
											fontSize: 24,
											fontWeight: 700,
											color: colors.text,
										}}
									>
										{item.title}
									</span>
									<span
										style={{
											fontSize: 17,
											color: colors.muted,
											lineHeight: 1.5,
										}}
									>
										{item.desc}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</AbsoluteFill>
	);
};
