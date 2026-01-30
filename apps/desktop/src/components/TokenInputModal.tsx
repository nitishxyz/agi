import { useState } from 'react';

export function TokenInputModal({
	onSave,
	onClose,
}: {
	onSave: (token: string) => Promise<void>;
	onClose: () => void;
}) {
	const [tokenInput, setTokenInput] = useState('');

	const handleSave = async () => {
		try {
			await onSave(tokenInput);
			onClose();
		} catch {
			alert('Invalid token');
		}
	};

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
				className="bg-background border border-border rounded-xl w-full max-w-md mx-6 shadow-2xl"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
			>
				<div className="p-6 border-b border-border">
					<h3 className="text-lg font-semibold text-foreground">
						Connect GitHub
					</h3>
				</div>
				<div className="p-6">
					<p className="text-sm text-muted-foreground mb-4">
						Create a{' '}
						<a
							href="https://github.com/settings/tokens/new?scopes=repo,user"
							target="_blank"
							rel="noopener noreferrer"
							className="text-foreground underline hover:no-underline"
						>
							Personal Access Token
						</a>{' '}
						with{' '}
						<code className="px-1.5 py-0.5 bg-muted rounded text-xs">repo</code>{' '}
						and{' '}
						<code className="px-1.5 py-0.5 bg-muted rounded text-xs">user</code>{' '}
						scopes.
					</p>
					<input
						type="password"
						placeholder="ghp_..."
						value={tokenInput}
						onChange={(e) => setTokenInput(e.target.value)}
						className="w-full h-11 px-4 bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors font-mono text-sm"
						onKeyDown={(e) => {
							if (e.key === 'Enter') handleSave();
							if (e.key === 'Escape') onClose();
						}}
					/>
				</div>
				<div className="flex gap-3 p-6 pt-0">
					<button
						type="button"
						onClick={onClose}
						className="flex-1 h-11 px-4 bg-transparent border border-border text-foreground rounded-lg font-medium hover:bg-muted/50 transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						disabled={!tokenInput}
						className="flex-1 h-11 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
					>
						Connect
					</button>
				</div>
			</div>
		</div>
	);
}
