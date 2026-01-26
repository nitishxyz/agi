import type { FC } from 'hono/jsx';
import { generateGradient } from '../lib/gradient';

interface OGImageProps {
	title: string;
	description?: string | null;
	username: string;
	model: string;
	messageCount: number;
	tokenCount?: number;
	createdAt: number;
	shareId: string;
}

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

export const OGImage: FC<OGImageProps> = ({
	title,
	description,
	username,
	model,
	messageCount,
	tokenCount,
	createdAt,
	shareId,
}) => {
	const gradient = generateGradient(shareId);

	return (
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				background: gradient,
				padding: '60px',
				fontFamily: 'Inter, sans-serif',
				color: 'white',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-start',
				}}
			>
				<div
					style={{
						fontSize: '28px',
						fontWeight: 700,
						opacity: 0.9,
					}}
				>
					AGI
				</div>
				<div
					style={{
						background: 'rgba(255,255,255,0.2)',
						padding: '10px 20px',
						borderRadius: '8px',
						fontSize: '18px',
						fontWeight: 500,
					}}
				>
					{model}
				</div>
			</div>

			<div
				style={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
				}}
			>
				<h1
					style={{
						fontSize: '56px',
						fontWeight: 700,
						marginBottom: '16px',
						lineHeight: 1.2,
					}}
				>
					{title}
				</h1>
				{description && (
					<p
						style={{
							fontSize: '28px',
							opacity: 0.85,
							marginTop: '0',
						}}
					>
						{description}
					</p>
				)}
			</div>

			<div
				style={{
					display: 'flex',
					gap: '40px',
					fontSize: '20px',
					opacity: 0.8,
				}}
			>
				<span>by {username}</span>
				<span>{messageCount} messages</span>
				{tokenCount && <span>{tokenCount.toLocaleString()} tokens</span>}
				<span>{formatDate(createdAt)}</span>
			</div>
		</div>
	);
};
