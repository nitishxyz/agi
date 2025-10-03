import type { RendererProps } from './types';

export function FinishRenderer({ toolDurationMs }: RendererProps) {
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs text-emerald-700 dark:text-emerald-300">
			Done {timeStr && <span className="text-muted-foreground/80">· {timeStr}</span>}
		</div>
	);
}
