import { useMemo } from 'react';
import type { Session } from '../../types/api';
import { Clock, DollarSign, Hash } from 'lucide-react';

interface SessionHeaderProps {
	session: Session;
}

export function SessionHeader({ session }: SessionHeaderProps) {
	// Calculate total tokens
	const totalTokens = useMemo(() => {
		const input = session.totalInputTokens || 0;
		const output = session.totalOutputTokens || 0;
		return input + output;
	}, [session.totalInputTokens, session.totalOutputTokens]);

	// Calculate estimated cost (example rates for GPT-4)
	// These should be adjusted based on the actual model
	const estimatedCost = useMemo(() => {
		const input = session.totalInputTokens || 0;
		const output = session.totalOutputTokens || 0;

		// Example rates (per 1M tokens):
		// GPT-4: $30 input, $60 output
		// GPT-3.5: $0.50 input, $1.50 output
		// These are approximate and should be updated based on actual model
		const inputCostPer1M = 30;
		const outputCostPer1M = 60;

		const inputCost = (input / 1_000_000) * inputCostPer1M;
		const outputCost = (output / 1_000_000) * outputCostPer1M;

		return inputCost + outputCost;
	}, [session.totalInputTokens, session.totalOutputTokens]);

	// Format time duration
	const formatDuration = (ms: number | null) => {
		if (!ms) return '0s';

		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);

		if (hours > 0) {
			const remainingMinutes = minutes % 60;
			return `${hours}h ${remainingMinutes}m`;
		}
		if (minutes > 0) {
			const remainingSeconds = seconds % 60;
			return `${minutes}m ${remainingSeconds}s`;
		}
		return `${seconds}s`;
	};

	// Format number with commas
	const formatNumber = (num: number) => {
		return num.toLocaleString('en-US');
	};

	return (
		<div className="border-b border-border bg-background/95 backdrop-blur-sm">
			<div className="max-w-3xl mx-auto px-6 py-6">
				{/* Title */}
				<h1 className="text-2xl font-semibold text-foreground mb-4">
					{session.title || 'Untitled Session'}
				</h1>

				{/* Session Stats */}
				<div className="flex flex-wrap gap-6 text-sm">
					{/* Total Tokens */}
					<div className="flex items-center gap-2 text-muted-foreground">
						<Hash className="w-4 h-4" />
						<div className="flex flex-col">
							<span className="text-xs uppercase tracking-wide opacity-70">
								Total Tokens
							</span>
							<span className="text-foreground font-medium">
								{formatNumber(totalTokens)}
							</span>
							{(session.totalInputTokens || session.totalOutputTokens) && (
								<span className="text-xs opacity-60">
									{formatNumber(session.totalInputTokens || 0)} in /{' '}
									{formatNumber(session.totalOutputTokens || 0)} out
								</span>
							)}
						</div>
					</div>

					{/* Total Time */}
					<div className="flex items-center gap-2 text-muted-foreground">
						<Clock className="w-4 h-4" />
						<div className="flex flex-col">
							<span className="text-xs uppercase tracking-wide opacity-70">
								Tool Time
							</span>
							<span className="text-foreground font-medium">
								{formatDuration(session.totalToolTimeMs)}
							</span>
						</div>
					</div>

					{/* Estimated Cost */}
					{estimatedCost > 0 && (
						<div className="flex items-center gap-2 text-muted-foreground">
							<DollarSign className="w-4 h-4" />
							<div className="flex flex-col">
								<span className="text-xs uppercase tracking-wide opacity-70">
									Est. Cost
								</span>
								<span className="text-foreground font-medium">
									${estimatedCost.toFixed(4)}
								</span>
							</div>
						</div>
					)}

					{/* Model Info */}
					<div className="flex items-center gap-2 text-muted-foreground ml-auto">
						<div className="flex flex-col items-end">
							<span className="text-xs uppercase tracking-wide opacity-70">
								Model
							</span>
							<span className="text-foreground font-medium">
								{session.model}
							</span>
							<span className="text-xs opacity-60">
								{session.provider} · {session.agent}
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
