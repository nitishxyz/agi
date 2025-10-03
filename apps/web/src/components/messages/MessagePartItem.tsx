import {
	Sparkles,
	Loader2,
	GitBranch,
	Diff,
	GitCommit,
	Check,
	Terminal,
	FileText,
	FileEdit,
	Search,
	FolderTree,
	List,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MessagePart } from '../../types/api';
import { ToolResultRenderer, type ContentJson } from './renderers';

interface MessagePartItemProps {
	part: MessagePart;
	showLine: boolean;
	isFirstPart: boolean;
	isLastToolCall?: boolean;
	isLastProgressUpdate?: boolean;
}

export function MessagePartItem({
	part,
	showLine,
	isLastToolCall,
	isLastProgressUpdate,
}: MessagePartItemProps) {
	if (part.type === 'tool_call' && !isLastToolCall) {
		return null;
	}

	// Hide progress_update unless it's the latest one (before finish)
	if (
		part.type === 'tool_result' &&
		part.toolName === 'progress_update' &&
		!isLastProgressUpdate
	) {
		return null;
	}

	// Hide empty text parts
	if (part.type === 'text') {
		const data = part.contentJson || part.content;
		let content = '';
		if (data && typeof data === 'object' && 'text' in data) {
			content = String(data.text);
		} else if (typeof data === 'string') {
			content = data;
		}
		if (!content || !content.trim()) {
			return null;
		}
	}

	const renderIcon = () => {
		if (part.type === 'tool_call') {
			return <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />;
		}

		if (part.type === 'tool_result') {
			const toolName = part.toolName || '';
			if (toolName === 'read')
				return <FileText className="h-4 w-4 text-blue-400" />;
			if (toolName === 'write')
				return <FileEdit className="h-4 w-4 text-green-400" />;
			if (toolName === 'edit')
				return <FileEdit className="h-4 w-4 text-purple-400" />;
			if (toolName === 'ls') return <List className="h-4 w-4 text-cyan-400" />;
			if (toolName === 'tree')
				return <FolderTree className="h-4 w-4 text-cyan-400" />;
			if (toolName === 'bash')
				return <Terminal className="h-4 w-4 text-zinc-400" />;
			if (toolName === 'ripgrep' || toolName === 'grep' || toolName === 'glob')
				return <Search className="h-4 w-4 text-yellow-400" />;
			if (toolName === 'apply_patch')
				return <Diff className="h-4 w-4 text-purple-400" />;
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

		return <Sparkles className="h-4 w-4 text-violet-400" />;
	};

	const renderToolResult = () => {
		const toolName = part.toolName || '';

		let contentJson: ContentJson;
		try {
			if (part.contentJson && typeof part.contentJson === 'object') {
				contentJson = part.contentJson as ContentJson;
			} else if (typeof part.content === 'string') {
				contentJson = JSON.parse(part.content);
			} else {
				contentJson = {};
			}
		} catch {
			contentJson = { result: part.content } as ContentJson;
		}

		return (
			<ToolResultRenderer
				toolName={toolName}
				contentJson={contentJson}
				toolDurationMs={part.toolDurationMs}
				debug={false}
			/>
		);
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
				<div className="text-base text-foreground/90 leading-relaxed markdown-content">
					<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
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
			return renderToolResult();
		}

		return null;
	};

	return (
		<div className="flex gap-3 pb-2 relative">
			{/* Icon with vertical line */}
			<div className="flex-shrink-0 w-6 flex items-start justify-center relative pt-0.5">
				<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full relative z-10 bg-background">
					{renderIcon()}
				</div>
				{/* Vertical line */}
				{showLine && (
					<div
						className="absolute left-1/2 -translate-x-1/2 w-[2px] bg-border z-0"
						style={{ top: '1.25rem', bottom: '-0.5rem' }}
					/>
				)}
			</div>

			{/* Content */}
			<div className="flex-1 pt-0.5">{renderContent()}</div>
		</div>
	);
}
