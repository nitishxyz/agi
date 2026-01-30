interface Repo {
	id: number;
	name: string;
	fullName: string;
	description: string | null;
	private: boolean;
	cloneUrl: string;
}

export function CloneModal({
	repos,
	cloning,
	onClone,
	onClose,
}: {
	repos: Repo[];
	cloning: boolean;
	onClone: (url: string, name: string) => void;
	onClose: () => void;
}) {
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop overlay pattern
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onClose}
			onKeyDown={(e) => {
				if (e.key === 'Escape') onClose();
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
						Clone from GitHub
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
					>
						✕
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-6">
					{repos.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							Loading repositories...
						</div>
					) : (
						<div className="space-y-2">
							{repos.map((repo) => (
								<div
									key={repo.id}
									className="flex items-center justify-between p-4 bg-card border border-border hover:border-ring rounded-xl transition-colors"
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<span>{repo.private ? '🔒' : '📦'}</span>
											<span className="font-medium text-foreground truncate">
												{repo.fullName}
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
										onClick={() => onClone(repo.cloneUrl, repo.name)}
										disabled={cloning}
										className="ml-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
									>
										Clone
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
