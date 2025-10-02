import type { RendererProps } from './types';

export function FinishRenderer({ toolDurationMs }: RendererProps) {
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';

	return (
		<div className="text-xs text-green-400">
			Done {timeStr && <span className="text-zinc-600">· {timeStr}</span>}
		</div>
	);
}
