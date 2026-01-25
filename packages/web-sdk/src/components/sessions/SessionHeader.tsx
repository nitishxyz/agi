import { useMemo } from 'react';
import { estimateModelCostUsd, type ProviderId } from '@agi-cli/sdk/browser';
import type { Session } from '../../types/api';
import { Clock, DollarSign, Hash, GitBranch, ArrowUpRight } from 'lucide-react';
import { useParentSession } from '../../hooks/useBranch';

interface SessionHeaderProps {
	session: Session;
	onNavigateToSession?: (sessionId: string) => void;
}

export function SessionHeader({
	session,
	onNavigateToSession,
}: SessionHeaderProps) {
	const { data: parentData } = useParentSession(
		session.sessionType === 'branch' ? session.id : undefined,
	);

	const totalTokens = useMemo(() => {
		const input = session.totalInputTokens || 0;
		const output = session.totalOutputTokens || 0;
		const cached = session.totalCachedTokens || 0;
		const cacheCreation = session.totalCacheCreationTokens || 0;
		return input + output + cached + cacheCreation;
	}, [
		session.totalInputTokens,
		session.totalOutputTokens,
		session.totalCachedTokens,
		session.totalCacheCreationTokens,
	]);

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

	const formatNumber = (num: number) => {
		return num.toLocaleString('en-US');
	};

	const isBranch = session.sessionType === 'branch';
	const parentSession = parentData?.parent;

	return (
		<div className="border-b border-border bg-background/95 backdrop-blur-sm">
			<div className="max-w-3xl mx-auto px-6 py-6">
				{isBranch && (
					<div className="flex items-center gap-2 mb-2 text-sm">
						<GitBranch className="h-4 w-4 text-violet-500" />
						<span className="text-violet-600 dark:text-violet-400">Branch</span>
						{parentSession && (
							<>
								<span className="text-muted-foreground">from</span>
								<button
									type="button"
									onClick={() => onNavigateToSession?.(parentSession.id)}
									className="text-primary hover:underline flex items-center gap-1"
								>
									{parentSession.title ||
										`Session ${parentSession.id.slice(0, 8)}`}
									<ArrowUpRight className="h-3 w-3" />
								</button>
							</>
						)}
						{!parentSession && session.parentSessionId && (
							<span className="text-muted-foreground italic">
								(parent deleted)
							</span>
						)}
					</div>
				)}

				<h1 className="text-2xl font-semibold text-foreground mb-4">
					{session.title || 'Untitled Session'}
				</h1>

				<div className="flex flex-wrap gap-6 text-sm">
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
									{(session.totalCachedTokens ||
										session.totalCacheCreationTokens) && (
										<span>
											{' '}
											(+{formatNumber(session.totalCachedTokens || 0)} cached, +
											{formatNumber(session.totalCacheCreationTokens || 0)}{' '}
											write)
										</span>
									)}
								</span>
							)}
						</div>
					</div>

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
