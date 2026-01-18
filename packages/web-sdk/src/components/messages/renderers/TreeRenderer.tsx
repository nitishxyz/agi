import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
	prism,
	vscDarkPlus,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RendererProps } from './types';
import { formatDuration, isToolError, getErrorMessage } from './utils';
import {
	ToolHeader,
	ToolHeaderSeparator,
	ToolHeaderDetail,
	ToolHeaderMeta,
} from './shared';
import { ToolErrorDisplay } from './ToolErrorDisplay';

export function TreeRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const hasError = isToolError(result);
	const errorMessage = getErrorMessage(result);
	const tree = String(result.tree || '');
	const lines = tree.split('\n').length;
	const timeStr = formatDuration(toolDurationMs);
	const syntaxTheme = document?.documentElement.classList.contains('dark')
		? vscDarkPlus
		: prism;
	const canExpand = tree.length > 0 || hasError;

	return (
		<div className="text-xs">
			<ToolHeader
				toolName="tree"
				isExpanded={isExpanded}
				onToggle={onToggle}
				isError={hasError}
				colorVariant="cyan"
				canExpand={canExpand}
			>
				<ToolHeaderSeparator />
				<ToolHeaderDetail>
					{lines} {lines === 1 ? 'line' : 'lines'}
				</ToolHeaderDetail>
				<ToolHeaderSeparator />
				<ToolHeaderMeta>{timeStr}</ToolHeaderMeta>
			</ToolHeader>
			{isExpanded && hasError && errorMessage && (
				<ToolErrorDisplay error={errorMessage} />
			)}
			{isExpanded && !hasError && tree && (
				<div className="mt-2 ml-5 bg-card/60 border border-border rounded-lg overflow-hidden max-h-96 overflow-y-auto max-w-full">
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
							{tree}
						</SyntaxHighlighter>
					</div>
				</div>
			)}
		</div>
	);
}
