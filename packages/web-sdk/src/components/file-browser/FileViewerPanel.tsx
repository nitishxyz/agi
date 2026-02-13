import { memo, useEffect } from 'react';
import { X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
	prism,
	vscDarkPlus,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useFileBrowserStore } from '../../stores/fileBrowserStore';
import { useFileContent } from '../../hooks/useFileBrowser';
import { Button } from '../ui/Button';

const LANGUAGE_MAP: Record<string, string> = {
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
	txt: 'plaintext',
	svelte: 'svelte',
	toml: 'toml',
	lock: 'plaintext',
};

function inferLanguage(path: string): string {
	const ext = path.split('.').pop()?.toLowerCase() ?? '';
	return LANGUAGE_MAP[ext] ?? 'plaintext';
}

export const FileViewerPanel = memo(function FileViewerPanel() {
	const isViewerOpen = useFileBrowserStore((s) => s.isViewerOpen);
	const selectedFile = useFileBrowserStore((s) => s.selectedFile);
	const closeViewer = useFileBrowserStore((s) => s.closeViewer);

	const { data, isLoading } = useFileContent(selectedFile);

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			const isInInput =
				target.tagName === 'INPUT' ||
				target.tagName === 'TEXTAREA' ||
				target.isContentEditable;
			if (
				(e.key === 'Escape' || (e.key === 'q' && !isInInput)) &&
				isViewerOpen
			) {
				closeViewer();
			}
		};

		document.addEventListener('keydown', handleEscape);
		return () => document.removeEventListener('keydown', handleEscape);
	}, [isViewerOpen, closeViewer]);

	if (!isViewerOpen || !selectedFile) return null;

	const syntaxTheme = document?.documentElement.classList.contains('dark')
		? vscDarkPlus
		: prism;
	const language = inferLanguage(selectedFile);

	return (
		<div className="absolute inset-0 bg-background z-50 flex flex-col animate-in slide-in-from-left duration-300">
			<div className="h-14 border-b border-border px-4 flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={closeViewer}
					title="Close file viewer (ESC)"
				>
					<X className="w-4 h-4" />
				</Button>
				<div className="flex-1 flex items-center gap-2 min-w-0">
					<span
						className="text-sm font-medium text-foreground font-mono truncate"
						title={selectedFile}
					>
						{selectedFile}
					</span>
					{data && (
						<span className="text-xs text-muted-foreground flex-shrink-0">
							{data.lineCount} lines
						</span>
					)}
				</div>
				<span className="text-xs text-muted-foreground">{language}</span>
			</div>

			<div className="flex-1 overflow-auto">
				{isLoading ? (
					<div className="h-full flex items-center justify-center text-muted-foreground">
						Loading file...
					</div>
				) : data ? (
					<SyntaxHighlighter
						language={language}
						style={syntaxTheme}
						showLineNumbers
						customStyle={{
							margin: 0,
							padding: '1rem',
							background: 'transparent',
						fontSize: '0.75rem',
						lineHeight: '1.25rem',
						}}
						lineNumberStyle={{
							minWidth: '3em',
							paddingRight: '1em',
							color: 'var(--color-muted-foreground)',
							userSelect: 'none',
						fontSize: '0.7rem',
						}}
					>
						{data.content}
					</SyntaxHighlighter>
				) : (
					<div className="h-full flex items-center justify-center text-muted-foreground">
						Unable to load file
					</div>
				)}
			</div>
		</div>
	);
});
