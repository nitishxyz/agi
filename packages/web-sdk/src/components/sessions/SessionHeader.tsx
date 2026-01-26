import { useMemo } from 'react';
import { estimateModelCostUsd, type ProviderId } from '@agi-cli/sdk/browser';
import type { Session } from '../../types/api';
import {
	Clock,
	DollarSign,
	Hash,
	GitBranch,
	ArrowUpRight,
	Share2,
	ExternalLink,
	RefreshCw,
} from 'lucide-react';
import { useParentSession } from '../../hooks/useBranch';
import { useShareStatus } from '../../hooks/useShareStatus';

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
	const { data: shareStatus } = useShareStatus(session.id);

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
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		return `${seconds}s`;
	};

	const formatNumber = (num: number) => num.toLocaleString('en-US');

	const formatCompactNumber = (num: number) => {
		if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
		if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
		return num.toString();
	};

	const isBranch = session.sessionType === 'branch';
	const parentSession = parentData?.parent;

	return (
		<div className="border-b border-border bg-background/95 backdrop-blur-sm">
			<div className="max-w-3xl mx-auto px-6 py-6">
				{isBranch && (
					<div className="flex items-center gap-2 mb-3 text-sm">
						<GitBranch className="h-4 w-4 text-violet-500" />
						<span className="text-violet-600 dark:text-violet-400 font-medium">
							Branch
						</span>
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
							<span className="text-muted-foreground italic text-xs">
								(parent deleted)
							</span>
						)}
					</div>
				)}

				<div className="flex items-center gap-3">
					<h1 className="text-2xl font-semibold text-foreground leading-tight truncate">
						{session.title || 'Untitled Session'}
					</h1>

					{shareStatus?.shared && (
						<a
							href={shareStatus.url}
							target="_blank"
							rel="noopener noreferrer"
							className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs font-medium flex-shrink-0"
						>
							<Share2 className="h-3 w-3" />
							<span>Shared</span>
							{shareStatus.pendingMessages && shareStatus.pendingMessages > 0 ? (
								<span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
									<RefreshCw className="h-2.5 w-2.5" />
									{shareStatus.pendingMessages}
								</span>
							) : (
								<ExternalLink className="h-2.5 w-2.5 opacity-60" />
							)}
						</a>
					)}
				</div>

				<div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm text-muted-foreground">
					<div
						className="flex items-center gap-2"
						title={`${formatNumber(session.totalInputTokens || 0)} in / ${formatNumber(session.totalOutputTokens || 0)} out${session.totalCachedTokens ? ` (+${formatNumber(session.totalCachedTokens)} cached)` : ''}`}
					>
						<Hash className="w-4 h-4" />
						<span className="font-medium text-foreground">
							{formatCompactNumber(totalTokens)}
						</span>
						<span className="opacity-70">tokens</span>
					</div>

					<div className="flex items-center gap-2">
						<Clock className="w-4 h-4" />
						<span className="font-medium text-foreground">
							{formatDuration(session.totalToolTimeMs)}
						</span>
					</div>

					{estimatedCost > 0 && (
						<div className="flex items-center gap-1.5">
							<DollarSign className="w-4 h-4" />
							<span className="font-medium text-foreground">
								{estimatedCost.toFixed(4)}
							</span>
						</div>
					)}

					<div className="flex items-center gap-2 ml-auto">
						<span className="font-medium text-foreground">{session.model}</span>
						<span className="opacity-50">·</span>
						<span className="opacity-70">{session.provider}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
