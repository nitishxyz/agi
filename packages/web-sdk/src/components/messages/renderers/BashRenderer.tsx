import { useState } from 'react';
import {
	ChevronDown,
	ChevronRight,
	AlertCircle,
	Terminal,
	Copy,
	Check,
} from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
	prism,
	vscDarkPlus,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { RendererProps } from './types';
import { formatDuration } from './utils';
import { ToolErrorDisplay } from './ToolErrorDisplay';

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async (e: React.MouseEvent) => {
		e.stopPropagation();
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {}
	};

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
			title="Copy"
		>
			{copied ? (
				<Check className="h-3 w-3 text-emerald-500" />
			) : (
				<Copy className="h-3 w-3" />
			)}
		</button>
	);
}

export function BashRenderer({
	contentJson,
	toolDurationMs,
	isExpanded,
	onToggle,
}: RendererProps) {
	const result = contentJson.result || {};
	const args = contentJson.args || {};

	const hasToolError =
		typeof result === 'object' && 'ok' in result && result.ok === false;
	const errorMessage =
		hasToolError && 'error' in result && typeof result.error === 'string'
			? result.error
			: null;
	const errorStack =
		hasToolError && 'stack' in result && typeof result.stack === 'string'
			? result.stack
			: undefined;

	const stdout = String(result.stdout || '');
	const stderr = String(result.stderr || '');
	const exitCode = Number(result.exitCode ?? 0);
	const cmd = String(args.cmd || '');
	const cwd = args.cwd ? String(args.cwd) : undefined;
	const timeStr = formatDuration(toolDurationMs);
	const syntaxTheme = document?.documentElement.classList.contains('dark')
		? vscDarkPlus
		: prism;

	const hasOutput = stdout.length > 0 || stderr.length > 0;

	const isError = hasToolError || exitCode !== 0;
	const hasStderr = stderr.length > 0;

	const combinedOutput = stdout + (stdout && stderr ? '\n' : '') + stderr;

	return (
		<div className="text-xs">
			<button
				type="button"
				onClick={onToggle}
				className={`flex items-center gap-2 transition-colors w-full min-w-0 ${
					isError
						? 'text-red-700 dark:text-red-300 hover:text-red-600 dark:hover:text-red-200'
						: 'text-muted-foreground hover:text-foreground'
				}`}
			>
				{isExpanded ? (
					<ChevronDown className="h-3 w-3 flex-shrink-0" />
				) : (
					<ChevronRight className="h-3 w-3 flex-shrink-0" />
				)}
				{isError && (
					<AlertCircle className="h-3 w-3 flex-shrink-0 text-red-600 dark:text-red-400" />
				)}
				<span className="font-medium flex-shrink-0">
					bash{hasToolError ? ' error' : ''}
				</span>
			<span className="text-muted-foreground/70 flex-shrink-0">·</span>
			<span
				className="text-foreground/70 min-w-0 truncate"
				title={cmd}
			>
					{cmd}
				</span>
				{!hasToolError && (
					<span
						className={`flex-shrink-0 whitespace-nowrap ${
							exitCode === 0
								? 'text-emerald-600 dark:text-emerald-400'
								: 'text-red-600 dark:text-red-400'
						}`}
					>
						· exit {exitCode} · {timeStr}
					</span>
				)}
				{hasToolError && (
					<span className="text-muted-foreground/80 flex-shrink-0">
						· {timeStr}
					</span>
				)}
			</button>
			{isExpanded && hasToolError && errorMessage && (
				<ToolErrorDisplay error={errorMessage} stack={errorStack} showStack />
			)}
			{isExpanded && !hasToolError && (
				<div className="mt-2 ml-5 flex flex-col gap-2 max-w-full">
					{/* Command box */}
					<div className="bg-card/60 border border-border rounded-lg overflow-hidden">
						<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground px-3 py-1.5 bg-muted/30 border-b border-border">
							<div className="flex items-center gap-2">
								<Terminal className="h-3 w-3" />
								<span>command</span>
								{cwd && cwd !== '.' && (
									<span className="text-muted-foreground/60">in {cwd}</span>
								)}
							</div>
							<CopyButton text={cmd} />
						</div>
						<div className="px-3 py-2 font-mono text-xs bg-muted/10 break-all">
							{cmd}
						</div>
					</div>

					{/* Output box */}
					{hasOutput && (
						<div className="bg-card/60 border border-border rounded-lg overflow-hidden flex flex-col max-h-80">
							{/* When exit code is 0, combine stdout/stderr as "output" */}
							{exitCode === 0 ? (
								<>
									<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground px-3 py-1.5 bg-muted/30 border-b border-border sticky top-0">
										<span>output</span>
										<CopyButton text={combinedOutput} />
									</div>
									<div className="overflow-auto flex-1">
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
											{combinedOutput}
										</SyntaxHighlighter>
									</div>
								</>
							) : (
								<>
									{/* When exit code != 0, show stdout and stderr separately */}
									{stdout && (
										<>
											<div className="flex items-center justify-between gap-2 text-xs text-muted-foreground px-3 py-1.5 bg-muted/30 border-b border-border sticky top-0">
												<span>stdout</span>
												<CopyButton text={stdout} />
											</div>
											<div className="overflow-auto max-h-40">
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
													{stdout}
												</SyntaxHighlighter>
											</div>
										</>
									)}
									{hasStderr && (
										<>
											<div className="flex items-center justify-between gap-2 text-xs text-red-600 dark:text-red-400 px-3 py-1.5 bg-red-500/10 border-b border-border sticky top-0">
												<span>stderr</span>
												<CopyButton text={stderr} />
											</div>
											<div className="overflow-auto max-h-40">
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
													{stderr}
												</SyntaxHighlighter>
											</div>
										</>
									)}
								</>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
