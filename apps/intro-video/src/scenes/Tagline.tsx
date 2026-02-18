import {
	AbsoluteFill,
	interpolate,
	useCurrentFrame,
	useVideoConfig,
	spring,
} from 'remotion';
import { colors, font } from '../theme';

export const Tagline: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const line1 = spring({
		frame: frame - 5,
		fps,
		config: { damping: 14, mass: 1, stiffness: 80 },
	});
	const line1Y = interpolate(line1, [0, 1], [80, 0]);
	const line1Rotate = interpolate(line1, [0, 1], [3, 0]);

	const line2 = spring({
		frame: frame - 22,
		fps,
		config: { damping: 14, mass: 1, stiffness: 80 },
	});
	const line2Y = interpolate(line2, [0, 1], [80, 0]);
	const line2Rotate = interpolate(line2, [0, 1], [-2, 0]);

	const descProgress = spring({
		frame: frame - 50,
		fps,
		config: { damping: 20, stiffness: 70 },
	});
	const descY = interpolate(descProgress, [0, 1], [40, 0]);

	const pillProgress = spring({
		frame: frame - 70,
		fps,
		config: { damping: 14, stiffness: 180 },
	});
	const pillScale = interpolate(pillProgress, [0, 1], [0.7, 1]);

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
					width: 1000,
					height: 600,
					background: `radial-gradient(ellipse 80% 50% at 50% 40%, ${colors.accent}0C, transparent)`,
					filter: 'blur(40px)',
				}}
			/>

			<div
				style={{
					position: 'absolute',
					width: 500,
					height: 500,
					background: `radial-gradient(circle, rgba(147,51,234,0.04), transparent 60%)`,
					transform: 'translate(-300px, 100px)',
					filter: 'blur(60px)',
				}}
			/>

			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 8,
					transform: `translateY(${floatY}px)`,
				}}
			>
				<div style={{ overflow: 'hidden', padding: '8px 0' }}>
					<div
						style={{
							fontSize: 100,
							fontWeight: 700,
							color: colors.text,
							opacity: line1,
							transform: `translateY(${line1Y}px) rotate(${line1Rotate}deg)`,
							letterSpacing: '-0.03em',
							lineHeight: 1.1,
						}}
					>
						Your codebase.
					</div>
				</div>

				<div style={{ overflow: 'hidden', padding: '8px 0' }}>
					<div
						style={{
							fontSize: 100,
							fontWeight: 700,
							color: colors.accent,
							opacity: line2,
							transform: `translateY(${line2Y}px) rotate(${line2Rotate}deg)`,
							letterSpacing: '-0.03em',
							lineHeight: 1.1,
						}}
					>
						Your rules.
					</div>
				</div>

				<div
					style={{
						marginTop: 36,
						fontSize: 28,
						color: colors.muted,
						opacity: descProgress,
						transform: `translateY(${descY}px)`,
						maxWidth: 640,
						textAlign: 'center' as const,
						lineHeight: 1.7,
					}}
				>
					An open-source AI assistant that reads, writes, and executes — right
					from your terminal.
				</div>

				<div style={{ display: 'flex', gap: 14, marginTop: 24 }}>
					{['Open-source', 'Provider-agnostic', 'Extensible'].map((tag, i) => {
						const tagDelay = 75 + i * 10;
						const tagProgress = spring({
							frame: frame - tagDelay,
							fps,
							config: { damping: 14, stiffness: 200 },
						});
						const tagScale = interpolate(tagProgress, [0, 1], [0.8, 1]);
						return (
							<div
								key={tag}
								style={{
									opacity: tagProgress,
									transform: `scale(${tagScale})`,
									padding: '10px 24px',
									borderRadius: 9999,
									background: colors.surface,
									border: `1px solid ${colors.border}`,
									fontSize: 17,
									fontWeight: 600,
									color: colors.muted,
									boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
								}}
							>
								{tag}
							</div>
						);
					})}
				</div>
			</div>
		</AbsoluteFill>
	);
};
