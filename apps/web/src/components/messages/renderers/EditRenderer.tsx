import type { RendererProps } from './types';

export function EditRenderer({ contentJson, toolDurationMs }: RendererProps) {
	const result = contentJson.result || {};
	const path = String(result.path || '');
	const opsApplied = Number(result.opsApplied || 0);
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs flex items-center gap-2 text-purple-400">
			<span className="font-medium">edit</span>
			<span className="text-zinc-500">·</span>
			<span className="text-zinc-300">{path}</span>
			<span className="text-zinc-600">
				· {opsApplied} ops · {timeStr}
			</span>
		</div>
	);
}
