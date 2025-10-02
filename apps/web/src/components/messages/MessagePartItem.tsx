import {
	Sparkles,
	Loader2,
	GitBranch,
	Diff,
	GitCommit,
	Check,
	Terminal,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { MessagePart } from '../../types/api';

interface MessagePartItemProps {
	part: MessagePart;
	showLine: boolean;
	isFirstPart: boolean;
	hasResult?: boolean;
}

export function MessagePartItem({
	part,
	showLine,
	hasResult,
}: MessagePartItemProps) {
	if (part.type === 'tool_call' && hasResult) {
		return null;
	}

	const renderIcon = () => {
		if (part.type === 'tool_call') {
			return <Loader2 className="h-3 w-3 text-amber-400 animate-spin" />;
		}

		if (part.type === 'tool_result') {
			const toolName = part.toolName || '';
			if (toolName === 'git_status')
				return <GitBranch className="h-4 w-4 text-blue-400" />;
			if (toolName === 'git_diff')
				return <Diff className="h-4 w-4 text-purple-400" />;
			if (toolName === 'git_commit')
				return <GitCommit className="h-4 w-4 text-emerald-400" />;
			if (toolName === 'finish')
				return <Check className="h-4 w-4 text-green-400" />;
			return <Terminal className="h-4 w-4 text-zinc-400" />;
		}

		return <Sparkles className="h-3 w-3 text-violet-400" />;
	};

	const renderContent = () => {
		if (part.type === 'text') {
			let content = '';
			const data = part.contentJson || part.content;
			if (data && typeof data === 'object' && 'text' in data) {
				content = String(data.text);
			} else if (typeof data === 'string') {
				content = data;
			} else if (data) {
				content = JSON.stringify(data, null, 2);
			}

			return (
				<div className="text-sm text-foreground/90 leading-relaxed prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 bg-muted/30 border border-border/50 rounded-xl px-4 py-3">
					<ReactMarkdown>{content}</ReactMarkdown>
				</div>
			);
		}

		if (part.type === 'tool_call') {
			const toolName = part.toolName || 'unknown';
			return (
				<div className="text-xs font-mono text-amber-400">
					<span className="animate-pulse">Running {toolName}...</span>
				</div>
			);
		}

		if (part.type === 'tool_result') {
			const toolName = part.toolName || '';

			if (toolName === 'finish') {
				return (
					<div className="text-xs font-mono text-green-400">
						<span>Done</span>
						{part.toolDurationMs && (
							<span className="ml-2 text-zinc-600">
								({part.toolDurationMs}ms)
							</span>
						)}
					</div>
				);
			}

			let result = '';
			try {
				const data =
					typeof part.content === 'string'
						? JSON.parse(part.content)
						: part.contentJson;
				if (data?.result) {
					result =
						typeof data.result === 'object'
							? JSON.stringify(data.result, null, 2)
							: String(data.result);
				}
			} catch {
				result = String(part.content);
			}

			return (
				<div className="text-xs font-mono">
					<div className="text-zinc-400">
						<span>{toolName}</span>
						{part.toolDurationMs && (
							<span className="ml-2 text-zinc-600">
								({part.toolDurationMs}ms)
							</span>
						)}
					</div>
					{result && (
						<pre className="mt-1 max-h-64 overflow-x-auto text-xs text-zinc-400">
							<code>{result}</code>
						</pre>
					)}
				</div>
			);
		}

		return null;
	};

	return (
		<div className="flex gap-4 pb-2 relative">
			{/* Icon with vertical line */}
			<div className="flex-shrink-0 w-8 flex items-start justify-center pt-1 relative">
				<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full relative z-10 bg-background">
					{renderIcon()}
				</div>
				{/* Vertical line */}
				{showLine && (
					<div
						className="absolute left-1/2 -translate-x-1/2 w-[2px] bg-border z-0"
						style={{ top: '2.25rem', bottom: '-0.5rem' }}
					/>
				)}
			</div>

			{/* Content */}
			<div className="flex-1 pt-0.5">{renderContent()}</div>
		</div>
	);
}
