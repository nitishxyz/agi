import { memo, useState } from 'react';
import { Shield, Check, X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
	prism,
	vscDarkPlus,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { PendingToolApproval } from '../../stores/toolApprovalStore';
import { DiffView } from './renderers/DiffView';

interface ToolApprovalCardProps {
	toolName: string;
	args: Record<string, unknown> | undefined;
	pendingApproval: PendingToolApproval;
	onApprove: (callId: string) => void;
	onReject: (callId: string) => void;
}

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
		svelte: 'svelte',
	};
	return langMap[ext || ''] || 'javascript';
}

function normalizeToolTarget(
	toolName: string,
	args: Record<string, unknown> | undefined,
): { key: string; value: string } | null {
	if (!args) return null;
	const keyMap: Record<string, string[]> = {
		read: ['path'],
		write: ['path'],
		edit: ['path'],
		apply_patch: ['path'],
		glob: ['pattern'],
		grep: ['query', 'pattern'],
		ripgrep: ['query', 'pattern'],
		bash: ['cmd', 'command'],
		terminal: ['command'],
		git_commit: ['message'],
		git_diff: ['file'],
	};
	const keys = keyMap[toolName];
	if (!keys) return null;
	for (const key of keys) {
		const value = args[key];
		if (typeof value === 'string' && value.length > 0) {
			return { key, value };
		}
	}
	return null;
}

function getPrimaryCommand(
	args: Record<string, unknown> | undefined,
): string | null {
	if (!args) return null;
	const cmd = args.cmd ?? args.command;
	if (typeof cmd === 'string' && cmd.length > 0) {
		return cmd;
	}
	return null;
}

export const ToolApprovalCard = memo(function ToolApprovalCard({
	toolName,
	args,
	pendingApproval,
	onApprove,
	onReject,
}: ToolApprovalCardProps) {
	const [isProcessing, setIsProcessing] = useState(false);

	const toolLabel = toolName.replace(/_/g, ' ');
	const primary = normalizeToolTarget(toolName, args);
	const command = toolName === 'bash' ? getPrimaryCommand(args) : null;
	const approvalTarget = command || primary?.value;

	const filePath = typeof args?.path === 'string' ? args.path : '';
	const language = getLanguageFromPath(filePath);
	const syntaxTheme = document?.documentElement.classList.contains('dark')
		? vscDarkPlus
		: prism;

	const handleApprove = () => {
		setIsProcessing(true);
		onApprove(pendingApproval.callId);
	};

	const handleReject = () => {
		setIsProcessing(true);
		onReject(pendingApproval.callId);
	};

	const renderContent = () => {
		if (toolName === 'apply_patch' && args?.patch) {
			return (
				<div className="ml-6 max-w-full overflow-hidden">
					<DiffView patch={String(args.patch)} />
				</div>
			);
		}

		if (toolName === 'write' && args?.content) {
			const content = String(args.content);
			return (
				<div className="ml-6 max-w-full overflow-hidden">
					<div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg overflow-hidden max-h-96">
						<div className="overflow-x-auto overflow-y-auto max-h-96 text-xs">
							<SyntaxHighlighter
								language={language}
								style={syntaxTheme}
								customStyle={{
									margin: 0,
									padding: '0.75rem',
									background: 'transparent',
									fontSize: 'inherit',
								}}
								showLineNumbers
								lineNumberStyle={{
									minWidth: '2.5em',
									paddingRight: '1em',
									color: 'var(--muted-foreground)',
									opacity: 0.4,
									userSelect: 'none',
								}}
							>
								{content}
							</SyntaxHighlighter>
						</div>
					</div>
				</div>
			);
		}

		if (toolName === 'bash' && args?.cmd) {
			const cmd = String(args.cmd);
			return (
				<div className="ml-6 max-w-full overflow-hidden">
					<div className="bg-card/60 border border-border rounded-lg overflow-hidden">
						<div className="overflow-x-auto text-xs">
							<SyntaxHighlighter
								language="bash"
								style={syntaxTheme}
								customStyle={{
									margin: 0,
									padding: '0.75rem',
									background: 'transparent',
									fontSize: 'inherit',
								}}
							>
								{cmd}
							</SyntaxHighlighter>
						</div>
					</div>
				</div>
			);
		}

		return null;
	};

	return (
		<div className="flex flex-col gap-2 py-1">
			<div className="flex items-center gap-2 flex-wrap">
				<Shield className="h-4 w-4 text-amber-500 flex-shrink-0" />
				<span className="font-medium text-foreground text-sm">{toolLabel}</span>
				{approvalTarget && toolName !== 'bash' && (
					<code className="text-xs font-mono text-foreground/80 bg-muted/50 px-1.5 py-0.5 rounded truncate max-w-xs">
						{approvalTarget}
					</code>
				)}
				<span className="text-amber-600 dark:text-amber-400 font-medium text-sm">
					requires approval
				</span>
			</div>
			{renderContent()}
			<div className="flex items-center gap-2 ml-6">
				<button
					type="button"
					onClick={handleReject}
					disabled={isProcessing}
					title="Reject (N or Esc)"
					className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-border bg-background hover:bg-muted transition-colors disabled:opacity-50"
				>
					<X className="w-3 h-3" />
					Reject
					<kbd className="ml-1 text-[10px] text-muted-foreground opacity-70">N</kbd>
				</button>
				<button
					type="button"
					onClick={handleApprove}
					disabled={isProcessing}
					title="Approve (Y)"
					className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
				>
					<Check className="w-3 h-3" />
					{isProcessing ? 'Approving...' : 'Approve'}
					{!isProcessing && (
						<kbd className="ml-1 text-[10px] opacity-70">Y</kbd>
					)}
				</button>
			</div>
		</div>
	);
});
