import { useState, useEffect, useCallback, useRef } from 'react';
import { Search } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';

interface CloneProgress {
	receivedObjects: number;
	totalObjects: number;
	receivedBytes: number;
	percent: number;
	phase: string;
}

interface Repo {
	id: number;
	name: string;
	full_name: string;
	description: string | null;
	private: boolean;
	clone_url: string;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CloneModal({
	repos,
	cloning,
	cloningRepo,
	onClone,
	onClose,
	onSearch,
	onLoadMore,
}: {
	repos: Repo[];
	cloning: boolean;
	cloningRepo: string | null;
	onClone: (url: string, name: string) => void;
	onClose: () => void;
	onSearch: (query: string) => void;
	onLoadMore: () => void;
}) {
	const [searchQuery, setSearchQuery] = useState('');
	const [cloneUrl, setCloneUrl] = useState('');
	const [progress, setProgress] = useState<CloneProgress | null>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const listRef = useRef<HTMLDivElement>(null);

	const handleSearch = useCallback(
		(query: string) => {
			setSearchQuery(query);
			if (debounceRef.current) clearTimeout(debounceRef.current);
			debounceRef.current = setTimeout(() => {
				onSearch(query);
			}, 300);
		},
		[onSearch],
	);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	useEffect(() => {
		if (!cloning) {
			setProgress(null);
			return;
		}
		const unlisten = listen<CloneProgress>('clone-progress', (event) => {
			setProgress(event.payload);
		});
		return () => {
			unlisten.then((fn) => fn());
		};
	}, [cloning]);

	const handleScroll = useCallback(() => {
		if (!listRef.current) return;
		const { scrollTop, scrollHeight, clientHeight } = listRef.current;
		if (scrollHeight - scrollTop - clientHeight < 100) {
			onLoadMore();
		}
	}, [onLoadMore]);

	const handleCloneUrl = () => {
		if (!cloneUrl.trim() || cloning) return;
		const name = cloneUrl
			.trim()
			.replace(/\.git$/, '')
			.split('/')
			.pop();
		if (name) {
			onClone(cloneUrl.trim(), name);
		}
	};

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop overlay pattern
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={cloning ? undefined : onClose}
			onKeyDown={(e) => {
				if (e.key === 'Escape' && !cloning) onClose();
			}}
			tabIndex={-1}
		>
			<div
				className="bg-background border border-border rounded-xl w-full max-w-2xl mx-6 shadow-2xl max-h-[80vh] flex flex-col"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
			>
				<div className="flex items-center justify-between p-6 border-b border-border">
					<h3 className="text-lg font-semibold text-foreground">
						Clone Repository
					</h3>
					<button
						type="button"
						onClick={onClose}
						disabled={cloning}
						className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
					>
						✕
					</button>
				</div>

				{cloning && cloningRepo && (
					<div className="px-4 pt-4">
						<div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
							<div className="flex items-center gap-3">
								<div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
								<div className="flex-1 min-w-0">
									<div className="text-sm font-medium text-foreground">
										Cloning {cloningRepo}...
									</div>
									<div className="text-xs text-muted-foreground mt-0.5">
										{progress
											? `${progress.phase} — ${progress.percent}% (${formatBytes(progress.receivedBytes)})`
											: 'Connecting...'}
									</div>
								</div>
							</div>
							<div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
								<div
									className="h-full bg-primary rounded-full transition-all duration-300"
									style={{ width: `${progress?.percent ?? 0}%` }}
								/>
							</div>
						</div>
					</div>
				)}

				<div className="p-4 border-b border-border space-y-3">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
						<input
							type="text"
							placeholder="Search your repositories..."
							value={searchQuery}
							onChange={(e) => handleSearch(e.target.value)}
							disabled={cloning}
							className="w-full h-10 pl-9 pr-4 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors text-sm disabled:opacity-50"
						/>
					</div>
					<div className="flex gap-2">
						<input
							type="text"
							placeholder="Or paste a clone URL (https://github.com/...)"
							value={cloneUrl}
							onChange={(e) => setCloneUrl(e.target.value)}
							disabled={cloning}
							onKeyDown={(e) => {
								if (e.key === 'Enter') handleCloneUrl();
							}}
							className="flex-1 h-10 px-3 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors text-sm font-mono disabled:opacity-50"
						/>
						<button
							type="button"
							onClick={handleCloneUrl}
							disabled={!cloneUrl.trim() || cloning}
							className="px-4 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
						>
							Clone
						</button>
					</div>
				</div>

				<div
					ref={listRef}
					className={`flex-1 overflow-y-auto p-4 ${cloning ? 'pointer-events-none opacity-60' : ''}`}
					onScroll={handleScroll}
				>
					{repos.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							{searchQuery
								? 'No repositories found'
								: 'Loading repositories...'}
						</div>
					) : (
						<div className="space-y-2">
							{repos.map((repo) => {
								const isThisCloning = cloning && cloningRepo === repo.full_name;
								return (
									<div
										key={repo.id}
										className={`flex items-center justify-between p-4 bg-card border rounded-xl transition-colors ${
											isThisCloning
												? 'border-primary/40 bg-primary/5'
												: 'border-border hover:border-ring'
										}`}
									>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<span>{repo.private ? '🔒' : '📦'}</span>
												<span className="font-medium text-foreground truncate">
													{repo.full_name}
												</span>
											</div>
											{repo.description && (
												<div className="text-sm text-muted-foreground truncate">
													{repo.description}
												</div>
											)}
										</div>
										<button
											type="button"
											onClick={() => onClone(repo.clone_url, repo.name)}
											disabled={cloning}
											className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
										>
											{isThisCloning && (
												<div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
											)}
											{isThisCloning ? 'Cloning...' : 'Clone'}
										</button>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
