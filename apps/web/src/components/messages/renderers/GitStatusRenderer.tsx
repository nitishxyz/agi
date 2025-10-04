import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RendererProps } from './types';
import { formatDuration } from './utils';

export function GitStatusRenderer({
	contentJson,
	toolDurationMs,
}: RendererProps) {
	const result = contentJson.result || {};
	const summary = String(result.summary || '');
	const timeStr = formatDuration(toolDurationMs);

	return (
		<div className="text-xs space-y-2">
			<div className="flex items-center gap-2">
				<span className="font-medium text-blue-700 dark:text-blue-300">
					git status
				</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-muted-foreground/80">{timeStr}</span>
			</div>
			{summary && (
				<div className="bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto max-w-full">
					<div className="overflow-x-auto max-w-full">
						<SyntaxHighlighter
							language="bash"
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
							{summary}
						</SyntaxHighlighter>
					</div>
				</div>
			)}
		</div>
	);
}
