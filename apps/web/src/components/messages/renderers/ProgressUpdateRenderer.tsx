import { Loader2 } from 'lucide-react';
import type { RendererProps } from './types';

export function ProgressUpdateRenderer({ contentJson }: RendererProps) {
	const result = contentJson.result || {};
	const message = String(result.message || 'Processing...');
	const stage = result.stage ? String(result.stage) : undefined;
	const pct = result.pct ? Number(result.pct) : undefined;

	return (
		<div className="flex items-center gap-2 text-sm text-violet-400">
			<Loader2 className="h-4 w-4 animate-spin" />
			{stage && <span className="text-zinc-500">[{stage}]</span>}
			<span>{message}</span>
			{pct !== undefined && <span className="text-zinc-600">({pct}%)</span>}
		</div>
	);
}
