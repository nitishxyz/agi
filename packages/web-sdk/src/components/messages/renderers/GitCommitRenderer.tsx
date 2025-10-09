import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
	prism,
	vscDarkPlus,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RendererProps } from './types';
import { formatDuration } from './utils';

export function GitCommitRenderer({
	contentJson,
	toolDurationMs,
}: RendererProps) {
	const result = contentJson.result || {};
	const message = String(result.message || '');
	const timeStr = formatDuration(toolDurationMs);
	const syntaxTheme = document?.documentElement.classList.contains('dark')
		? vscDarkPlus
		: prism;

	return (
		<div className="text-xs space-y-2">
			<div className="flex items-center gap-2">
				<span className="font-medium text-emerald-700 dark:text-emerald-300">
					git commit
				</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-muted-foreground/80">{timeStr}</span>
			</div>
			{message && (
				<div className="bg-card/60 border border-border rounded-lg overflow-hidden max-w-full">
					<div className="overflow-x-auto max-w-full">
						<SyntaxHighlighter
							language="bash"
							style={syntaxTheme}
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
							{message}
						</SyntaxHighlighter>
					</div>
				</div>
			)}
		</div>
	);
}
