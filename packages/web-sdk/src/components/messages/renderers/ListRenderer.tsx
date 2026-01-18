import { File, Folder } from 'lucide-react';
import type { RendererProps } from './types';
import { formatDuration, isToolError, getErrorMessage } from './utils';
import {
	ToolHeader,
	ToolHeaderSeparator,
	ToolHeaderDetail,
	ToolHeaderMeta,
} from './shared';
import { ToolErrorDisplay } from './ToolErrorDisplay';

export function ListRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const hasError = isToolError(result);
	const errorMessage = getErrorMessage(result);
	const entries = (result.entries as Array<unknown>) || [];
	const timeStr = formatDuration(toolDurationMs);
	const canExpand = entries.length > 0 || hasError;

	return (
		<div className="text-xs">
			<ToolHeader
				toolName="ls"
				isExpanded={isExpanded}
				onToggle={onToggle}
				isError={hasError}
				colorVariant="cyan"
				canExpand={canExpand}
			>
				<ToolHeaderSeparator />
				<ToolHeaderDetail>
					{entries.length} {entries.length === 1 ? 'entry' : 'entries'}
				</ToolHeaderDetail>
				<ToolHeaderSeparator />
				<ToolHeaderMeta>{timeStr}</ToolHeaderMeta>
			</ToolHeader>
			{isExpanded && hasError && errorMessage && (
				<ToolErrorDisplay error={errorMessage} />
			)}
			{isExpanded && !hasError && entries.length > 0 && (
				<div className="mt-2 ml-5 space-y-0.5 max-h-96 overflow-y-auto">
					{entries.map((entry, i) => {
						const e = entry as {
							name?: string;
							type?: string;
							isDirectory?: boolean;
						};
						const isDir = e.type === 'dir' || e.isDirectory;
						return (
							<div
								key={`${e.name}-${i}`}
								className="flex items-center gap-1.5 text-xs font-mono text-foreground/80"
							>
								{isDir ? (
									<Folder className="h-3 w-3 text-blue-500" />
								) : (
									<File className="h-3 w-3 text-muted-foreground" />
								)}
								<span>{e.name}</span>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
