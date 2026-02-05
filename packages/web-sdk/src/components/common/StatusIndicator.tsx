import { memo } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

type StatusType = 'loading' | 'success' | 'error';

interface StatusIndicatorProps {
	status: StatusType;
	label?: string;
	sublabel?: string;
	size?: 'sm' | 'md' | 'lg';
}

const OttoWordmarkLogo = ({ height = 22 }: { height?: number }) => {
	const width = Math.round(height * (748 / 303));
	return (
		<svg
			width={width}
			height={height}
			viewBox="0 0 748 303"
			fill="currentColor"
			className="text-foreground"
			aria-label="otto"
			role="img"
		>
			<path d="M192.877 257.682C192.877 263.287 191.783 268.551 189.596 273.473C187.545 278.395 184.674 282.701 180.982 286.393C177.428 289.947 173.189 292.818 168.268 295.006C163.482 297.057 158.287 298.082 152.682 298.082H44.1953C38.7266 298.082 33.5312 297.057 28.6094 295.006C23.6875 292.818 19.3809 289.947 15.6895 286.393C12.1348 282.701 9.26367 278.395 7.07617 273.473C5.02539 268.551 4 263.287 4 257.682V120.074C4 114.469 5.02539 109.205 7.07617 104.283C9.26367 99.3613 12.1348 95.123 15.6895 91.5684C19.3809 87.877 23.6875 85.0059 28.6094 82.9551C33.5312 80.7676 38.7266 79.6738 44.1953 79.6738H152.682C158.287 79.6738 163.482 80.7676 168.268 82.9551C173.189 85.0059 177.428 87.877 180.982 91.5684C184.674 95.123 187.545 99.3613 189.596 104.283C191.783 109.205 192.877 114.469 192.877 120.074V257.682ZM44.1953 120.074V257.682H152.682V120.074H44.1953ZM331.715 4V298.082H289.674V46.041H239.225V4H331.715ZM478.961 4V298.082H436.92V46.041H386.471V4H478.961ZM743.717 257.682C743.717 263.287 742.623 268.551 740.436 273.473C738.385 278.395 735.514 282.701 731.822 286.393C728.268 289.947 724.029 292.818 719.107 295.006C714.322 297.057 709.127 298.082 703.521 298.082H595.035C589.566 298.082 584.371 297.057 579.449 295.006C574.527 292.818 570.221 289.947 566.529 286.393C562.975 282.701 560.104 278.395 557.916 273.473C555.865 268.551 554.84 263.287 554.84 257.682V120.074C554.84 114.469 555.865 109.205 557.916 104.283C560.104 99.3613 562.975 95.123 566.529 91.5684C570.221 87.877 574.527 85.0059 579.449 82.9551C584.371 80.7676 589.566 79.6738 595.035 79.6738H703.521C709.127 79.6738 714.322 80.7676 719.107 82.9551C724.029 85.0059 728.268 87.877 731.822 91.5684C735.514 95.123 738.385 99.3613 740.436 104.283C742.623 109.205 743.717 114.469 743.717 120.074V257.682ZM595.035 120.074V257.682H703.521V120.074H595.035Z" />
		</svg>
	);
};

const sizeConfig = {
	sm: { ring: 48, icon: 20, iconSize: 16 },
	md: { ring: 72, icon: 32, iconSize: 24 },
	lg: { ring: 96, icon: 40, iconSize: 32 },
};

export const StatusIndicator = memo(function StatusIndicator({
	status,
	label,
	sublabel,
	size = 'md',
}: StatusIndicatorProps) {
	const { ring, icon, iconSize } = sizeConfig[size];

	const ringStyle: React.CSSProperties = {
		position: 'relative',
		display: 'flex',
		alignItems: 'center',
		justifyContent: 'center',
		width: ring,
		height: ring,
	};

	const baseRingStyle: React.CSSProperties = {
		content: '""',
		position: 'absolute',
		inset: 0,
		borderRadius: '50%',
	};

	const getBorderColor = () => {
		if (status === 'success') return 'rgb(34, 197, 94)';
		if (status === 'error') return 'rgb(239, 68, 68)';
		return 'currentColor';
	};

	return (
		<div className="flex flex-col items-center justify-center gap-5">
			<div style={ringStyle}>
				<div
					style={{
						...baseRingStyle,
						border: '2px solid hsl(var(--muted))',
					}}
				/>
				{status === 'loading' && (
					<div
						className="animate-spin"
						style={{
							...baseRingStyle,
							border: '2px solid transparent',
							borderTopColor: 'hsl(var(--foreground))',
							animation: 'spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite',
						}}
					/>
				)}
				{status === 'success' && (
					<div
						style={{
							...baseRingStyle,
							border: `2px solid ${getBorderColor()}`,
							opacity: 0.3,
						}}
					/>
				)}
				{status === 'error' && (
					<div
						style={{
							...baseRingStyle,
							border: `2px solid ${getBorderColor()}`,
							opacity: 0.3,
						}}
					/>
				)}
				<div style={{ position: 'relative', zIndex: 1 }}>
				{status === 'loading' && <OttoWordmarkLogo height={Math.round(icon * 0.65)} />}
					{status === 'success' && (
						<CheckCircle
							className="text-green-500"
							style={{ width: iconSize, height: iconSize }}
						/>
					)}
					{status === 'error' && (
						<XCircle
							className="text-red-500"
							style={{ width: iconSize, height: iconSize }}
						/>
					)}
				</div>
			</div>
			{label && (
				<div className="flex flex-col items-center gap-1">
					<span className="text-sm font-medium text-foreground">{label}</span>
					{sublabel && (
						<span className="text-xs text-muted-foreground">{sublabel}</span>
					)}
				</div>
			)}
		</div>
	);
});
