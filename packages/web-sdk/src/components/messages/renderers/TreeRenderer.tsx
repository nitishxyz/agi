import { ChevronDown, ChevronRight } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RendererProps } from './types';
import { formatDuration } from './utils';

export function TreeRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const tree = String(result.tree || '');
	const lines = tree.split('\n').length;
	const timeStr = formatDuration(toolDurationMs);

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 transition-colors hover:text-cyan-600 dark:hover:text-cyan-200"
			>
				{isExpanded ? (
					<ChevronDown className="h-3 w-3" />
				) : (
					<ChevronRight className="h-3 w-3" />
				)}
				<span className="font-medium">tree</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70">
					{lines} {lines === 1 ? 'line' : 'lines'}
				</span>
				<span className="text-muted-foreground/80">· {timeStr}</span>
			</button>
			{isExpanded && tree && (
				<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto max-w-full">
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
							{tree}
						</SyntaxHighlighter>
					</div>
				</div>
			)}
		</div>
	);
}
