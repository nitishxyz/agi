import type { RendererProps } from './types';

export function EditRenderer({ contentJson, toolDurationMs }: RendererProps) {
	const result = contentJson.result || {};
	const path = String(result.path || '');
	const opsApplied = Number(result.opsApplied || 0);
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs flex items-center gap-2 text-purple-700 dark:text-purple-300">
			<span className="font-medium">edit</span>
			<span className="text-muted-foreground/70">·</span>
			<span className="text-foreground/70 truncate max-w-xs">{path}</span>
			<span className="text-muted-foreground/80">
				· {opsApplied} ops · {timeStr}
			</span>
		</div>
	);
}
