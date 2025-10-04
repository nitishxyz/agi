import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RendererProps } from './types';
import { formatDuration } from './utils';

export function GenericRenderer({
	toolName,
	contentJson,
	toolDurationMs,
}: RendererProps) {
	const result = contentJson.result;
	const timeStr = formatDuration(toolDurationMs);

	return (
		<div className="text-xs space-y-2">
			<div className="flex items-center gap-2">
				<span className="font-medium text-foreground">{toolName}</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-muted-foreground/80">{timeStr}</span>
			</div>
			{result && (
				<div className="bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto max-w-full">
					<div className="overflow-x-auto max-w-full">
						<SyntaxHighlighter
							language="json"
							style={vscDarkPlus}
							customStyle={{
								margin: 0,
								padding: '0.75rem',
								fontSize: '0.75rem',
								lineHeight: '1.5',
								background: 'transparent',
								maxWidth: '100%',
							}}
							wrapLines
							wrapLongLines
						>
							{JSON.stringify(result, null, 2)}
						</SyntaxHighlighter>
					</div>
				</div>
			)}
		</div>
	);
}
