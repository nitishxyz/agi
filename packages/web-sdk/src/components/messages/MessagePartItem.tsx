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
	AlertCircle,
	XOctagon,
	Brain,
} from 'lucide-react';
import { Fragment, memo, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MessagePart } from '../../types/api';
import {
	ToolResultRenderer,
	ReasoningRenderer,
	type ContentJson,
} from './renderers';

function getToolCallPayload(part: MessagePart): Record<string, unknown> | null {
	const fromJson = part.contentJson;
	if (fromJson && typeof fromJson === 'object') {
		return fromJson;
	}
	try {
		if (part.content) {
			const parsed = JSON.parse(part.content);
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				return parsed as Record<string, unknown>;
			}
		}
	} catch {}
	return null;
}

function getToolCallArgs(
	part: MessagePart,
): Record<string, unknown> | undefined {
	const payload = getToolCallPayload(part);
	if (!payload) return undefined;

	// The args should be nested under an 'args' key
	const args = (payload as { args?: unknown }).args;
	if (args && typeof args === 'object' && !Array.isArray(args)) {
		return args as Record<string, unknown>;
	}

	// No valid args found
	return undefined;
}

function getPrimaryCommand(
	args: Record<string, unknown> | undefined,
): string | null {
	if (!args) return null;
	const candidates = ['cmd', 'command', 'script', 'input'];
	for (const key of candidates) {
		const value = args[key];
		if (typeof value === 'string' && value.trim().length > 0) {
			return value.trim();
		}
	}
	return null;
}

function normalizeToolTarget(
	toolName: string,
	args: Record<string, unknown> | undefined,
): { key: string; value: string } | null {
	if (!args) return null;
	const candidates = [
		{ key: 'path', match: true },
		{ key: 'file', match: true },
		{ key: 'target', match: true },
		{ key: 'cwd', match: true },
		{ key: 'query', match: true },
		{ key: 'pattern', match: true },
		{ key: 'glob', match: true },
		{ key: 'dir', match: true },
	];
	for (const { key } of candidates) {
		const value = args[key];
		if (typeof value === 'string' && value.trim().length > 0) {
			return { key, value: value.trim() };
		}
	}
	if (toolName === 'bash') {
		const command = args.command;
		if (typeof command === 'string' && command.trim().length > 0) {
			return { key: 'command', value: command.trim() };
		}
	}
	return null;
}

function formatArgsPreview(
	args: Record<string, unknown> | undefined,
	skipKey?: string,
): string | null {
	if (!args) return null;
	const pieces: string[] = [];
	for (const [key, value] of Object.entries(args)) {
		if (skipKey && key === skipKey) continue;
		if (typeof value === 'string' || typeof value === 'number') {
			const rendered = `${key}=${String(value)}`;
			pieces.push(rendered);
		}
		if (pieces.length >= 3) break;
	}
	if (!pieces.length) return null;
	const joined = pieces.join('  ');
	return joined.length > 120 ? `${joined.slice(0, 117)}…` : joined;
}

interface MessagePartItemProps {
	part: MessagePart;
	showLine: boolean;
	isFirstPart: boolean;
	isLastToolCall?: boolean;
	isLastProgressUpdate?: boolean;
}

// Memoize the component to prevent re-renders when props haven't changed
export const MessagePartItem = memo(
	function MessagePartItem({
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

		const isToolMessage =
			part.type === 'tool_call' || part.type === 'tool_result';

		const contentClasses = ['flex-1', 'min-w-0', 'max-w-full'];

		if (isToolMessage || part.type === 'reasoning') {
			contentClasses.push('pt-1');
		} else if (part.type === 'error') {
			contentClasses.push('pt-0.5');
		} else if (part.type === 'text') {
			contentClasses.push('pt-0');
			contentClasses.push('-mt-0.5');
		} else {
			contentClasses.push('pt-0');
		}

		const contentClassName = contentClasses.join(' ');

		const renderIcon = () => {
			if (part.type === 'reasoning') {
				return (
					<Brain className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
				);
			}

			if (part.type === 'tool_call') {
				return (
					<Loader2 className="h-4 w-4 text-amber-600 dark:text-amber-300 animate-spin" />
				);
			}

			if (part.type === 'error') {
				// Check if it's an abort
				const payload = getToolCallPayload(part);
				const isAborted = payload?.isAborted === true;
				return isAborted ? (
					<XOctagon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
				) : (
					<AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
				);
			}

			if (part.type === 'tool_result') {
				const toolName = part.toolName || '';
				if (toolName === 'read')
					return (
						<FileText className="h-4 w-4 text-blue-600 dark:text-blue-300" />
					);
				if (toolName === 'write')
					return (
						<FileEdit className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
					);
				if (toolName === 'edit')
					return (
						<FileEdit className="h-4 w-4 text-purple-600 dark:text-purple-300" />
					);
				if (toolName === 'ls')
					return <List className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />;
				if (toolName === 'tree')
					return (
						<FolderTree className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
					);
				if (toolName === 'bash')
					return <Terminal className="h-4 w-4 text-muted-foreground" />;
				if (
					toolName === 'ripgrep' ||
					toolName === 'grep' ||
					toolName === 'glob'
				)
					return (
						<Search className="h-4 w-4 text-amber-600 dark:text-amber-300" />
					);
				if (toolName === 'apply_patch')
					return (
						<Diff className="h-4 w-4 text-purple-600 dark:text-purple-300" />
					);
				if (toolName === 'git_status')
					return (
						<GitBranch className="h-4 w-4 text-blue-600 dark:text-blue-300" />
					);
				if (toolName === 'git_diff')
					return (
						<Diff className="h-4 w-4 text-purple-600 dark:text-purple-300" />
					);
				if (toolName === 'git_commit')
					return (
						<GitCommit className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
					);
				if (toolName === 'finish')
					return (
						<Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
					);
				return <Terminal className="h-4 w-4 text-muted-foreground" />;
			}

			return (
				<Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-300" />
			);
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
			if (part.type === 'reasoning') {
				return <ReasoningRenderer part={part} />;
			}

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
					<div className="text-base text-foreground leading-relaxed markdown-content max-w-full overflow-hidden">
						<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
					</div>
				);
			}

			if (part.type === 'error') {
				// Render error using ToolResultRenderer with 'error' as toolName
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
					contentJson = {
						message: part.content || 'Unknown error',
					} as ContentJson;
				}

				return (
					<ToolResultRenderer
						toolName="error"
						contentJson={contentJson}
						toolDurationMs={part.toolDurationMs}
						debug={false}
					/>
				);
			}

			if (part.type === 'tool_call') {
				const payload = getToolCallPayload(part);
				const rawToolName =
					part.toolName ||
					(typeof (payload as { name?: unknown })?.name === 'string'
						? ((payload as { name?: unknown }).name as string)
						: 'tool');
				const toolLabel = rawToolName.replace(/_/g, ' ');
				const args = getToolCallArgs(part);
				const primary = normalizeToolTarget(rawToolName, args);
				const argsPreview = formatArgsPreview(args, primary?.key);
				const command = rawToolName === 'bash' ? getPrimaryCommand(args) : null;
				const segments: Array<{ key: string; node: ReactNode }> = [];
				if (command) {
					segments.push({
						key: 'cmd',
						node: (
							<code className="font-mono text-foreground/90 truncate max-w-xs">
								{command}
							</code>
						),
					});
				} else if (primary) {
					segments.push({
						key: 'primary',
						node: (
							<code className="font-mono text-foreground/85 truncate max-w-xs">
								{primary.value}
							</code>
						),
					});
				}
				if (argsPreview) {
					segments.push({
						key: 'args',
						node: (
							<span className="text-muted-foreground/80 truncate max-w-xs">
								{argsPreview}
							</span>
						),
					});
				}

				// If there are no segments at all (no primary target, no args preview),
				// show "running…"
				if (segments.length === 0) {
					segments.push({
						key: 'running',
						node: <span className="text-muted-foreground/75">running…</span>,
					});
				}

				const containerClasses = [
					'flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground/80 max-w-full',
				];
				if (part.ephemeral) containerClasses.push('animate-pulse');
				return (
					<div className={containerClasses.join(' ')}>
						<span className="font-medium text-foreground">{toolLabel}</span>
						{segments.map((segment) => (
							<Fragment key={segment.key}>
								<span className="text-muted-foreground/65">·</span>
								{segment.node}
							</Fragment>
						))}
					</div>
				);
			}

			if (part.type === 'tool_result') {
				return renderToolResult();
			}

			return null;
		};

		return (
			<div className="flex gap-3 pb-2 relative max-w-full overflow-hidden">
				{/* Icon with vertical line */}
				<div className="flex-shrink-0 w-6 flex items-start justify-center relative pt-0.5">
					<div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full relative bg-background">
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
				<div className={contentClassName}>{renderContent()}</div>
			</div>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison function for better memoization
		// Only re-render if the part content, showLine, or flags have actually changed
		return (
			prevProps.part.id === nextProps.part.id &&
			prevProps.part.content === nextProps.part.content &&
			prevProps.part.contentJson === nextProps.part.contentJson &&
			prevProps.part.ephemeral === nextProps.part.ephemeral &&
			prevProps.part.completedAt === nextProps.part.completedAt &&
			prevProps.showLine === nextProps.showLine &&
			prevProps.isLastToolCall === nextProps.isLastToolCall &&
			prevProps.isLastProgressUpdate === nextProps.isLastProgressUpdate
		);
	},
);
