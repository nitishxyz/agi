import { ChevronRight } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { GenericRendererProps } from './types';
import { formatDuration } from './utils';

export function GenericRenderer({
	toolName,
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: GenericRendererProps) {
	const result = contentJson.result;
	const timeStr = formatDuration(toolDurationMs);
	const hasResult = result && Object.keys(result).length > 0;

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className="flex items-center gap-2 text-foreground transition-colors hover:text-foreground/80 w-full"
			>
				<ChevronRight
					className={`h-3 w-3 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
				/>
				<span className="font-medium flex-shrink-0">{toolName}</span>
				<span className="text-muted-foreground/70 flex-shrink-0">·</span>
				<span className="text-muted-foreground/80 flex-shrink-0">
					{timeStr}
				</span>
			</button>
			{isExpanded && hasResult && (
				<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto max-w-full">
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
