import type { RendererProps } from './types';

export function DebugRenderer({
	contentJson,
	toolDurationMs,
}: RendererProps & { toolName: string }) {
	return (
		<div className="text-xs">
			<div className="text-zinc-400">
				<div>Tool: {contentJson.name}</div>
				<div>Duration: {toolDurationMs}ms</div>
				<pre className="mt-2 text-[10px] bg-zinc-900 p-2 rounded overflow-x-auto">
					{JSON.stringify(contentJson, null, 2)}
				</pre>
			</div>
		</div>
	);
}
