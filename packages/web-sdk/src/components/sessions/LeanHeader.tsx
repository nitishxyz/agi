import { useMemo } from 'react';
import type { Session } from '../../types/api';
import { Hash, DollarSign, Bot } from 'lucide-react';
import { StopButton } from '../chat/StopButton';

interface LeanHeaderProps {
	session: Session;
	isVisible: boolean;
	isGenerating?: boolean;
}

export function LeanHeader({
	session,
	isVisible,
	isGenerating,
}: LeanHeaderProps) {
	const totalTokens = useMemo(() => {
		const input = session.totalInputTokens || 0;
		const output = session.totalOutputTokens || 0;
		return input + output;
	}, [session.totalInputTokens, session.totalOutputTokens]);

	const estimatedCost = useMemo(() => {
		const input = session.totalInputTokens || 0;
		const output = session.totalOutputTokens || 0;

		const inputCostPer1M = 30;
		const outputCostPer1M = 60;

		const inputCost = (input / 1_000_000) * inputCostPer1M;
		const outputCost = (output / 1_000_000) * outputCostPer1M;

		return inputCost + outputCost;
	}, [session.totalInputTokens, session.totalOutputTokens]);

	const formatNumber = (num: number) => {
		return num.toLocaleString('en-US');
	};

	return (
		<div
			className={`absolute top-0 left-0 right-0 h-14 border-b border-border bg-background/95 backdrop-blur-sm z-30 transition-transform duration-200 ${
				isVisible ? 'translate-y-0' : '-translate-y-full'
			}`}
		>
			<div className="h-full px-6 flex items-center justify-between gap-6 text-sm">
				<div className="flex items-center gap-4">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Bot className="w-4 h-4" />
						<span className="text-foreground font-medium">
							{session.agent}
						</span>
					</div>

					{isGenerating && <StopButton sessionId={session.id} />}
				</div>

				<div className="flex items-center gap-6">
					<div className="flex items-center gap-2 text-muted-foreground">
						<Hash className="w-4 h-4" />
						<span className="text-foreground font-medium">
							{formatNumber(totalTokens)}
						</span>
					</div>

					{estimatedCost > 0 && (
						<div className="flex items-center gap-2 text-muted-foreground">
							<DollarSign className="w-4 h-4" />
							<span className="text-foreground font-medium">
								${estimatedCost.toFixed(4)}
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
