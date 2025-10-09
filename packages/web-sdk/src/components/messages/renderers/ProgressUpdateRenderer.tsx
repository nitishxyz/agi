import type { RendererProps } from './types';

export function ProgressUpdateRenderer({ contentJson }: RendererProps) {
	const result = contentJson.result || {};
	const message = String(result.message || 'Processing...');
	const stage = result.stage ? String(result.stage) : undefined;
	const pct = result.pct ? Number(result.pct) : undefined;

	return (
		<div className="flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300 animate-pulse">
			{stage && <span className="text-muted-foreground/80">[{stage}]</span>}
			<span>{message}</span>
			{pct !== undefined && (
				<span className="text-muted-foreground/80">({pct}%)</span>
			)}
		</div>
	);
}
