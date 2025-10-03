import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RendererProps } from './types';

export function GenericRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps & { toolName: string }) {
	const result = contentJson.result || {};
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';
	const resultStr =
		typeof result === 'object'
			? JSON.stringify(result, null, 2)
			: String(result);

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={() => resultStr && onToggle()}
				className={`flex items-center gap-2 text-muted-foreground ${resultStr ? 'hover:text-foreground transition-colors' : ''}`}
			>
				{resultStr &&
					(isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					))}
				{!resultStr && <div className="w-3" />}
				<span className="font-medium">{contentJson.name || 'unknown'}</span>
				<span className="text-muted-foreground/80">· {timeStr}</span>
			</button>
			{isExpanded && resultStr && (
				<pre className="mt-2 ml-5 max-h-64 overflow-x-auto text-xs text-muted-foreground bg-card/60 border border-border rounded-lg p-3">
					<code>{resultStr}</code>
				</pre>
			)}
		</div>
	);
}
