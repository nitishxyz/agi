import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

interface OGRequest {
	title: string;
	username: string;
	model: string;
	provider: string;
	messageCount: number;
	inputTokens?: number;
	outputTokens?: number;
	cachedTokens?: number;
	tokenCount?: number;
	createdAt: number;
	shareId: string;
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
	'claude-sonnet-4-20250514': { input: 3, output: 15 },
	'claude-opus-4-20250514': { input: 15, output: 75 },
	'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
	'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
	'gpt-4o': { input: 2.5, output: 10 },
	'gpt-4o-mini': { input: 0.15, output: 0.6 },
	'gpt-4-turbo': { input: 10, output: 30 },
	o1: { input: 15, output: 60 },
	'o1-mini': { input: 1.1, output: 4.4 },
	'o3-mini': { input: 1.1, output: 4.4 },
	'gemini-2.0-flash': { input: 0.1, output: 0.4 },
	'gemini-2.5-pro-preview-06-05': { input: 1.25, output: 10 },
	'gemini-2.5-flash-preview-05-20': { input: 0.15, output: 0.6 },
};

function estimateCost(
	model: string,
	inputTokens: number,
	outputTokens: number,
): number {
	const costs = MODEL_COSTS[model];
	if (!costs) return 0;
	return (
		(inputTokens / 1_000_000) * costs.input +
		(outputTokens / 1_000_000) * costs.output
	);
}

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
	});
}

function formatCompactNumber(num: number): string {
	if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
	if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
	return num.toString();
}

async function loadFont(): Promise<ArrayBuffer> {
	const response = await fetch(
		'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5.0.8/files/ibm-plex-mono-latin-400-normal.woff',
	);
	return response.arrayBuffer();
}

async function generateOGImage(data: OGRequest): Promise<Buffer> {
	const font = await loadFont();

	const cost =
		data.inputTokens && data.outputTokens
			? estimateCost(data.model, data.inputTokens, data.outputTokens)
			: 0;

	const bgColor = '#141318';
	const fgColor = '#fafafa';
	const mutedColor = '#71717a';
	const cardColor = '#1c1b22';

	const svg = await satori(
		<div
			style={{
				width: '100%',
				height: '100%',
				display: 'flex',
				flexDirection: 'column',
				background: bgColor,
				padding: '56px',
				fontFamily: 'IBM Plex Mono',
				color: fgColor,
			}}
		>
			{/* Header */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					marginBottom: '40px',
				}}
			>
				<div
					style={{
						fontSize: '24px',
						fontWeight: 600,
						color: fgColor,
						letterSpacing: '-0.02em',
					}}
				>
					utto
				</div>
				<div
					style={{
						fontSize: '16px',
						color: mutedColor,
					}}
				>
					{data.model}
				</div>
			</div>

			{/* Title */}
			<div
				style={{
					flex: 1,
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'center',
				}}
			>
				<div
					style={{
						fontSize: '48px',
						fontWeight: 600,
						lineHeight: 1.2,
						color: fgColor,
						letterSpacing: '-0.02em',
						maxWidth: '1000px',
					}}
				>
					{data.title}
				</div>
			</div>

			{/* Stats Footer */}
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'flex-end',
				}}
			>
				{/* Left side - meta info */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						fontSize: '16px',
						color: mutedColor,
					}}
				>
					<span>{data.username}</span>
					<span style={{ margin: '0 16px', opacity: 0.5 }}>·</span>
					<span>{data.messageCount} messages</span>
					<span style={{ margin: '0 16px', opacity: 0.5 }}>·</span>
					<span>{formatDate(data.createdAt)}</span>
				</div>

				{/* Right side - usage stats */}
				{(data.inputTokens || data.tokenCount) && (
					<div
						style={{
							display: 'flex',
							alignItems: 'center',
							background: cardColor,
							padding: '14px 24px',
							borderRadius: '8px',
							fontSize: '18px',
						}}
					>
						{data.inputTokens && data.outputTokens ? (
							<>
								<span style={{ color: mutedColor, marginRight: '8px' }}>
									in
								</span>
								<span style={{ color: fgColor, fontWeight: 500 }}>
									{formatCompactNumber(data.inputTokens)}
								</span>
								<span
									style={{
										color: mutedColor,
										marginLeft: '24px',
										marginRight: '8px',
									}}
								>
									out
								</span>
								<span style={{ color: fgColor, fontWeight: 500 }}>
									{formatCompactNumber(data.outputTokens)}
								</span>
								{cost > 0 && (
									<>
										<span
											style={{
												color: mutedColor,
												marginLeft: '24px',
												marginRight: '4px',
											}}
										>
											$
										</span>
										<span style={{ color: fgColor, fontWeight: 500 }}>
											{cost.toFixed(2)}
										</span>
									</>
								)}
							</>
						) : (
							<>
								<span style={{ color: fgColor, fontWeight: 500 }}>
									{formatCompactNumber(data.tokenCount || 0)}
								</span>
								<span style={{ color: mutedColor, marginLeft: '8px' }}>
									tokens
								</span>
							</>
						)}
					</div>
				)}
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
			fonts: [
				{
					name: 'IBM Plex Mono',
					data: font,
					weight: 400,
					style: 'normal',
				},
				{
					name: 'IBM Plex Mono',
					data: font,
					weight: 500,
					style: 'normal',
				},
				{
					name: 'IBM Plex Mono',
					data: font,
					weight: 600,
					style: 'normal',
				},
			],
		},
	);

	const resvg = new Resvg(svg, {
		fitTo: {
			mode: 'width',
			value: 1200,
		},
	});
	const pngData = resvg.render();
	return Buffer.from(pngData.asPng());
}

// Sample data for preview
const sampleData: OGRequest = {
	title: 'Audit Solana program with detailed solutions',
	username: 'bat',
	model: 'claude-opus-4-20250514',
	provider: 'anthropic',
	messageCount: 42,
	inputTokens: 550900,
	outputTokens: 12300,
	createdAt: Date.now(),
	shareId: 'test-preview',
};

// Run the preview
async function main() {
	console.log('Generating OG image preview...');
	const buffer = await generateOGImage(sampleData);
	const outputPath = 'preview.png';
	writeFileSync(outputPath, buffer);
	console.log(`✓ Saved to ${outputPath}`);
	console.log('\nSample data used:');
	console.log(JSON.stringify(sampleData, null, 2));
}

main().catch(console.error);
