import { ChevronDown, ChevronRight } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RendererProps } from './types';

function getLanguageFromPath(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase();
	const langMap: Record<string, string> = {
		js: 'javascript',
		jsx: 'jsx',
		ts: 'typescript',
		tsx: 'tsx',
		py: 'python',
		rb: 'ruby',
		go: 'go',
		rs: 'rust',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		h: 'c',
		hpp: 'cpp',
		cs: 'csharp',
		php: 'php',
		sh: 'bash',
		bash: 'bash',
		zsh: 'bash',
		sql: 'sql',
		json: 'json',
		yaml: 'yaml',
		yml: 'yaml',
		xml: 'xml',
		html: 'html',
		css: 'css',
		scss: 'scss',
		md: 'markdown',
		txt: 'text',
	};
	return langMap[ext || ''] || 'text';
}

export function ReadRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const path = String(result.path || '');
	const content = String(result.content || '');
	const lines = content.split('\n');
	const timeStr = toolDurationMs ? `${toolDurationMs}ms` : '';
	const language = getLanguageFromPath(path);

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className="flex items-center gap-2 text-blue-700 dark:text-blue-300 transition-colors hover:text-blue-600 dark:hover:text-blue-200"
			>
				{isExpanded ? (
					<ChevronDown className="h-3 w-3" />
				) : (
					<ChevronRight className="h-3 w-3" />
				)}
				<span className="font-medium">read</span>
				<span className="text-muted-foreground/70">·</span>
				<span className="text-foreground/70 truncate max-w-xs">{path}</span>
				<span className="text-muted-foreground/80">
					· {lines.length} lines · {timeStr}
				</span>
			</button>
			{isExpanded && content && (
				<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto max-w-full">
					<div className="overflow-x-auto max-w-full">
						<SyntaxHighlighter
							language={language}
							style={vscDarkPlus}
							customStyle={{
								margin: 0,
								padding: '0.75rem',
								fontSize: '0.75rem',
								lineHeight: '1.5',
								background: 'transparent',
								maxWidth: '100%',
							}}
							showLineNumbers
							wrapLines
							wrapLongLines
						>
							{content}
						</SyntaxHighlighter>
					</div>
				</div>
			)}
		</div>
	);
}
