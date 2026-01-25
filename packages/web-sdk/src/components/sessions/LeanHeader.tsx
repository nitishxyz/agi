import { useMemo } from 'react';
import { estimateModelCostUsd, type ProviderId } from '@agi-cli/sdk/browser';
import type { Session } from '../../types/api';
import {
	Hash,
	DollarSign,
	MessageSquare,
	GitBranch,
	ArrowUpRight,
} from 'lucide-react';
import { StopButton } from '../chat/StopButton';
import { useParentSession } from '../../hooks/useBranch';

interface LeanHeaderProps {
	session: Session;
	isVisible: boolean;
	isGenerating?: boolean;
	onNavigateToSession?: (sessionId: string) => void;
}

export function LeanHeader({
	session,
	isVisible,
	isGenerating,
	onNavigateToSession,
}: LeanHeaderProps) {
	const { data: parentData } = useParentSession(
		session.sessionType === 'branch' ? session.id : undefined,
	);

	const estimatedCost = useMemo(() => {
		const inputTokens = session.totalInputTokens || 0;
		const outputTokens = session.totalOutputTokens || 0;
		const cachedInputTokens = session.totalCachedTokens || 0;
		const cacheCreationInputTokens = session.totalCacheCreationTokens || 0;
		return (
			estimateModelCostUsd(session.provider as ProviderId, session.model, {
				inputTokens,
				outputTokens,
				cachedInputTokens,
				cacheCreationInputTokens,
			}) ?? 0
		);
	}, [
		session.provider,
		session.model,
		session.totalInputTokens,
		session.totalOutputTokens,
		session.totalCachedTokens,
		session.totalCacheCreationTokens,
	]);

	const formatNumber = (num: number) => {
		return num.toLocaleString('en-US');
	};

	const isBranch = session.sessionType === 'branch';
	const parentSession = parentData?.parent;

	return (
		<div
			className={`absolute top-0 left-0 right-0 h-14 border-b border-border bg-background/95 backdrop-blur-sm z-10 transition-transform duration-200 ${
				isVisible ? 'translate-y-0' : '-translate-y-full'
			}`}
		>
			<div className="h-full px-6 flex items-center justify-between gap-6 text-sm">
				<div className="flex-1 min-w-0 flex items-center gap-2 text-muted-foreground">
					{isBranch ? (
						<GitBranch className="w-4 h-4 flex-shrink-0 text-violet-500" />
					) : (
						<MessageSquare className="w-4 h-4 flex-shrink-0" />
					)}
					<span className="text-foreground font-medium truncate">
						{session.title || 'Untitled Session'}
					</span>
					{isBranch && parentSession && (
						<>
							<span className="text-muted-foreground hidden sm:inline">
								from
							</span>
							<button
								type="button"
								onClick={() => onNavigateToSession?.(parentSession.id)}
								className="text-primary hover:underline flex items-center gap-0.5 truncate max-w-32"
								title={
									parentSession.title ||
									`Session ${parentSession.id.slice(0, 8)}`
								}
							>
								<span className="truncate">
									{parentSession.title ||
										`Session ${parentSession.id.slice(0, 8)}`}
								</span>
								<ArrowUpRight className="h-3 w-3 flex-shrink-0" />
							</button>
						</>
					)}
				</div>

				<div className="flex-shrink-0 flex items-center gap-6">
					{isGenerating && <StopButton sessionId={session.id} />}

					<div className="flex items-center gap-2 text-muted-foreground">
						<Hash className="w-4 h-4" />
						<span className="text-foreground font-medium">
							{formatNumber(session.totalInputTokens || 0)} /{' '}
							{formatNumber(session.totalOutputTokens || 0)}{' '}
							{(session.totalCachedTokens ||
								session.totalCacheCreationTokens) && (
								<span className="text-xs opacity-60">
									(+{formatNumber(session.totalCachedTokens || 0)} cached, +
									{formatNumber(session.totalCacheCreationTokens || 0)} write)
								</span>
							)}
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
