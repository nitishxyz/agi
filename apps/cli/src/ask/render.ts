import chalk from 'chalk';
import type { Artifact } from '@agi-cli/sdk';

type ToolCallResult = unknown;
import type {
	ToolResultRecord,
	ToolCallRecord,
	TokenUsageSummary,
} from './types.ts';

// Export color utilities
export const dim = chalk.dim;
export const bold = chalk.bold;

// Tool color coding matching web UI
const TOOL_COLORS = {
	// Read operations - blue
	read: chalk.blue,
	ls: chalk.blue,
	tree: chalk.blue,
	ripgrep: chalk.blue,
	grep: chalk.blue,
	glob: chalk.cyan,
	git_status: chalk.blue,
	git_diff: chalk.blue,

	// Write operations - green
	write: chalk.green,
	edit: chalk.green,
	apply_patch: chalk.green,
	git_commit: chalk.green,

	// Execute operations - yellow
	bash: chalk.yellow,

	// Search operations - magenta
	websearch: chalk.magenta,

	// Meta operations - cyan
	finish: chalk.cyan,
	progress_update: chalk.cyan,
	update_plan: chalk.cyan,
};

function getToolColor(toolName: string): typeof chalk.cyan {
	return TOOL_COLORS[toolName as keyof typeof TOOL_COLORS] || chalk.cyan;
}

// Colorize diff lines
function colorizeDiffLine(line: string): string {
	if (line.startsWith('+++') || line.startsWith('---')) {
		return chalk.bold(line);
	}
	if (line.startsWith('+')) {
		return chalk.green(line);
	}
	if (line.startsWith('-')) {
		return chalk.red(line);
	}
	if (line.startsWith('@@')) {
		return chalk.cyan(line);
	}
	return chalk.dim(line);
}

// Extract a short preview from args for condensed display
function extractArgPreview(toolName: string, args: unknown): string {
	if (!args || typeof args !== 'object') return '';

	const obj = args as Record<string, unknown>;

	// Special handling for common tools
	switch (toolName) {
		case 'write':
		case 'read':
		case 'edit':
			if (typeof obj.path === 'string') return obj.path;
			break;
		case 'bash':
			if (typeof obj.cmd === 'string') {
				const cmd =
					obj.cmd.length > 50 ? `${obj.cmd.slice(0, 50)}...` : obj.cmd;
				return cmd;
			}
			break;
		case 'ripgrep':
		case 'grep':
		case 'glob':
			if (typeof obj.query === 'string') return `"${obj.query}"`;
			if (typeof obj.pattern === 'string') return `"${obj.pattern}"`;
			if (typeof obj.filePattern === 'string') return `"${obj.filePattern}"`;
			break;
		case 'websearch':
			if (typeof obj.query === 'string') return `"${obj.query}"`;
			if (typeof obj.url === 'string') return obj.url;
			break;
		case 'git_commit':
			if (typeof obj.message === 'string') {
				const firstLine = obj.message.split('\n')[0];
				return firstLine && firstLine.length > 60
					? `${firstLine.slice(0, 60)}...`
					: firstLine || '';
			}
			break;
		case 'finish':
			if (typeof obj.text === 'string') {
				const firstLine = obj.text.split('\n')[0];
				return firstLine && firstLine.length > 60
					? `${firstLine.slice(0, 60)}...`
					: firstLine || '';
			}
			break;
		case 'progress_update':
			if (typeof obj.message === 'string') {
				return obj.message.length > 60
					? `${obj.message.slice(0, 60)}...`
					: obj.message;
			}
			break;
		case 'update_plan':
			if (Array.isArray(obj.items)) {
				return `${obj.items.length} ${obj.items.length === 1 ? 'step' : 'steps'}`;
			}
			break;
		case 'ls':
		case 'tree':
			if (typeof obj.path === 'string') return obj.path;
			break;
		case 'apply_patch':
			if (typeof obj.patch === 'string') {
				const lines = obj.patch.split('\n');
				const firstHunk = lines.find((l) => l.startsWith('@@'));
				return firstHunk ? firstHunk.slice(0, 60) : 'patch';
			}
			break;
	}

	return '';
}

// Print a tool call
export function printToolCall(
	toolName: string,
	args: unknown,
	opts: { verbose?: boolean } = {},
): void {
	const color = getToolColor(toolName);

	if (opts.verbose) {
		const argsStr =
			args && typeof args === 'object'
				? JSON.stringify(args, null, 2)
				: String(args);
		console.log(color(`  ▶ ${toolName}`));
		if (args) {
			const lines = argsStr.split('\n');
			for (const line of lines) {
				console.log(chalk.dim(`    ${line}`));
			}
		}
	} else {
		// Condensed format: show tool name and brief preview
		// Add newline before tool call to separate from LLM message
		const preview = extractArgPreview(toolName, args);
		if (preview) {
			Bun.write(
				Bun.stderr,
				`\n${bold('›')} ${color(toolName)} ${dim('›')} ${preview}\n`,
			);
		} else {
			Bun.write(Bun.stderr, `\n${bold('›')} ${color(toolName)}\n`);
		}
	}
}

// Log a tool error
export function logToolError(
	toolName: string,
	errorMessage: string,
	opts: { durationMs?: number } = {},
): void {
	const duration = opts.durationMs ? chalk.dim(` (${opts.durationMs}ms)`) : '';
	console.log(chalk.red(`  ✗ ${toolName} error${duration}`));
	console.log(chalk.red(`    ${errorMessage}`));
}

// Print a plan update
export function printPlan(items: unknown, note?: string): void {
	if (!Array.isArray(items) || items.length === 0) return;

	console.log(chalk.bold('\n📋 Plan:'));
	if (note) {
		console.log(chalk.dim(`   ${note}`));
	}

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		let step: string;
		let status: string | undefined;

		if (typeof item === 'string') {
			step = item;
		} else if (item && typeof item === 'object' && 'step' in item) {
			step = String(item.step);
			status = 'status' in item ? String(item.status) : undefined;
		} else {
			continue;
		}

		const statusIcon =
			status === 'completed'
				? chalk.green('✓')
				: status === 'in_progress'
					? chalk.yellow('⋯')
					: chalk.dim('○');

		console.log(`   ${statusIcon} ${step}`);
	}
	console.log();
}

// Print execution summary
export function printSummary(
	toolCalls: ToolCallRecord[],
	_toolResults: ToolResultRecord[],
	filesTouched: Set<string> | string[],
	tokenUsage?: TokenUsageSummary | null,
): void {
	if (toolCalls.length === 0 && filesTouched.size === 0 && !tokenUsage) {
		return;
	}

	console.log(chalk.bold('\n📊 Summary:'));

	// Tool counts
	if (toolCalls.length > 0) {
		const counts = new Map<string, number>();
		for (const call of toolCalls) {
			counts.set(call.name, (counts.get(call.name) || 0) + 1);
		}

		console.log(chalk.dim('   Tools:'));
		for (const [name, count] of counts) {
			console.log(`     • ${name} × ${count}`);
		}
	}

	// Files touched
	const filesArray = Array.isArray(filesTouched)
		? filesTouched
		: Array.from(filesTouched);
	if (filesArray.length > 0) {
		console.log(chalk.dim('   Files:'));
		const displayFiles = filesArray.slice(0, 10);
		for (const file of displayFiles) {
			console.log(`     • ${file}`);
		}
		if (filesArray.length > 10) {
			console.log(chalk.dim(`     … and ${filesArray.length - 10} more`));
		}
	}

	// Token usage
	if (tokenUsage) {
		console.log(chalk.dim('   Tokens:'));
		if (tokenUsage.inputTokens !== undefined) {
			console.log(`     • Input: ${tokenUsage.inputTokens.toLocaleString()}`);
		}
		if (tokenUsage.outputTokens !== undefined) {
			console.log(`     • Output: ${tokenUsage.outputTokens.toLocaleString()}`);
		}
		if (tokenUsage.totalTokens !== undefined) {
			console.log(`     • Total: ${tokenUsage.totalTokens.toLocaleString()}`);
		}
		if (tokenUsage.costUsd !== undefined) {
			console.log(`     • Cost: $${tokenUsage.costUsd.toFixed(4)}`);
		}
	}

	console.log();
}

export function printToolResult(
	toolName: string,
	result: ToolCallResult,
	artifact?: Artifact,
	opts: {
		verbose?: boolean;
		durationMs?: number;
		error?: string;
		args?: unknown;
	} = {},
): void {
	const duration = opts.durationMs ? chalk.dim(`(${opts.durationMs}ms)`) : '';
	const color = getToolColor(toolName);

	// Handle errors first
	if (opts.error) {
		console.log(chalk.red(`  ✗ ${toolName} error ${duration}`));
		console.log(chalk.red(`    ${opts.error}`));
		return;
	}

	// Handle progress_update - always show the message
	if (toolName === 'progress_update') {
		if (typeof result === 'object' && result !== null && 'message' in result) {
			const message = String(result.message);
			const stage = 'stage' in result ? String(result.stage) : '';
			const stageIcon = stage ? chalk.dim(`[${stage}]`) : '';
			console.log(`  ${chalk.cyan('⋯')} ${message} ${stageIcon}`);
		}
		return;
	}

	// Handle update_plan - show the plan
	if (toolName === 'update_plan') {
		if (typeof result === 'object' && result !== null && 'items' in result) {
			printPlan(
				result.items,
				'note' in result ? String(result.note) : undefined,
			);
		}
		return;
	}

	// Handle websearch results - clean and minimal
	if (toolName === 'websearch') {
		if ('error' in result) {
			// Error result
			console.log(chalk.red(`  ✗ websearch error ${duration}`));
			console.log(chalk.red(`    ${result.error}`));
			if ('query' in result && result.query) {
				console.log(chalk.dim(`    Query: "${result.query}"`));
			}
			if ('suggestion' in result && result.suggestion) {
				console.log(chalk.yellow(`    💡 ${result.suggestion}`));
			}
			return;
		}

		if ('results' in result && 'query' in result) {
			// Search results - ultra clean format
			const resultCount = result.count || result.results?.length || 0;
			console.log(
				chalk.magenta(
					`  ↳ ${resultCount} ${resultCount === 1 ? 'result' : 'results'} ${duration}`,
				),
			);

			if (result.results && result.results.length > 0) {
				const displayCount = Math.min(3, result.results.length);
				console.log();

				for (let i = 0; i < displayCount; i++) {
					const r = result.results[i];
					if (!r) continue;

					// Title on one line
					console.log(`  ${i + 1}. ${chalk.bold(r.title)}`);

					// URL on second line
					console.log(`     ${chalk.cyan(r.url)}`);

					// Description on third/fourth line (max 2 lines, 100 chars each)
					if (r.snippet) {
						const maxCharsPerLine = 100;
						const words = r.snippet.split(' ');
						let currentLine = '';
						let lineCount = 0;
						const maxLines = 2;

						for (const word of words) {
							if (lineCount >= maxLines) break;

							if (`${currentLine} ${word}`.length > maxCharsPerLine) {
								if (currentLine) {
									console.log(`     ${chalk.dim(currentLine.trim())}`);
									lineCount++;
									currentLine = word;
								} else {
									console.log(
										`     ${chalk.dim(word.slice(0, maxCharsPerLine))}`,
									);
									lineCount++;
									currentLine = '';
								}
							} else {
								currentLine += (currentLine ? ' ' : '') + word;
							}
						}

						if (currentLine && lineCount < maxLines) {
							console.log(`     ${chalk.dim(currentLine.trim())}`);
						}
					}

					// Blank line between results
					if (i < displayCount - 1) {
						console.log();
					}
				}

				if (result.results.length > displayCount) {
					console.log();
					console.log(
						chalk.dim(`  … and ${result.results.length - displayCount} more`),
					);
				}
			} else {
				console.log(chalk.dim('  No results found'));
			}
			return;
		}

		if ('content' in result && 'url' in result) {
			// URL fetch result - compact preview
			const charCount = result.contentLength?.toLocaleString() || 'unknown';
			const lineCount = result.content
				? result.content.split('\n').length.toLocaleString()
				: 'unknown';

			console.log(
				chalk.magenta(
					`  ↳ ${charCount} chars · ${lineCount} lines ${duration}`,
				),
			);

			if (result.content) {
				const lines = result.content.split('\n');
				const displayLines = Math.min(3, lines.length);
				console.log();

				for (let i = 0; i < displayLines; i++) {
					const line = lines[i];
					if (line !== undefined) {
						// Truncate each line to 100 chars
						const truncated =
							line.length > 100 ? `${line.slice(0, 100)}...` : line;
						console.log(`  ${chalk.dim(truncated)}`);
					}
				}

				if (lines.length > displayLines) {
					console.log(
						chalk.dim(`  … and ${lines.length - displayLines} more lines`),
					);
				}
			}
			return;
		}
	}

	// Handle bash results - always show these (truncate to 7 lines)
	if (toolName === 'bash') {
		if ('stdout' in result || 'stderr' in result) {
			const code = 'exitCode' in result ? result.exitCode : undefined;
			const status =
				code === 0 ? chalk.green('✓') : code ? chalk.red(`✗ (${code})`) : '';
			console.log(color(`  ↳ bash ${status} ${duration}`));
			if (result.stdout) {
				const lines = result.stdout.split('\n');
				const displayLines = Math.min(7, lines.length);
				const preview = lines.slice(0, displayLines).join('\n');
				console.log(
					chalk.dim(
						preview
							.split('\n')
							.map((l) => `    ${l}`)
							.join('\n'),
					),
				);
				if (lines.length > displayLines) {
					console.log(
						chalk.dim(`    … and ${lines.length - displayLines} more lines`),
					);
				}
			}
			if (result.stderr) {
				const lines = result.stderr.split('\n');
				const displayLines = Math.min(7, lines.length);
				const preview = lines.slice(0, displayLines).join('\n');
				console.log(
					chalk.red(
						preview
							.split('\n')
							.map((l) => `    ${l}`)
							.join('\n'),
					),
				);
				if (lines.length > displayLines) {
					console.log(
						chalk.red(`    … and ${lines.length - displayLines} more lines`),
					);
				}
			}
			return;
		}
	}

	// Handle tree results - always show these (truncate to 7 lines)
	if (toolName === 'tree') {
		console.log(color(`  ↳ ${toolName} ${duration}`));
		if (typeof result === 'object' && result !== null && 'tree' in result) {
			const tree = String(result.tree);
			const lines = tree.split('\n').slice(0, 7);
			console.log(chalk.dim(lines.map((l) => `    ${l}`).join('\n')));
			if (tree.split('\n').length > 7) {
				console.log(
					chalk.dim(`    … and ${tree.split('\n').length - 7} more lines`),
				);
			}
		}
		return;
	}

	// Handle diff artifacts for write, edit, apply_patch - always show these with colors (truncate to 7 lines)
	if (
		artifact &&
		typeof artifact === 'object' &&
		artifact.kind === 'file_diff' &&
		typeof artifact.patch === 'string'
	) {
		// Check if there's an error in the result
		const hasError =
			typeof result === 'object' &&
			result !== null &&
			'error' in result &&
			result.error;
		const hasOkFalse =
			typeof result === 'object' &&
			result !== null &&
			'ok' in result &&
			result.ok === false;

		if (hasError || hasOkFalse) {
			// Show error for apply_patch failures
			console.log(chalk.red(`  ✗ ${toolName} error ${duration}`));
			if (hasError) {
				console.log(chalk.red(`    ${result.error}`));
			}
			// Still show a preview of the patch that failed
			console.log(chalk.dim('    Patch that failed:'));
			const lines = artifact.patch.split('\n').slice(0, 5);
			for (const line of lines) {
				console.log(chalk.dim(`    ${line}`));
			}
			if (artifact.patch.split('\n').length > 5) {
				console.log(
					chalk.dim(
						`    … and ${artifact.patch.split('\n').length - 5} more lines`,
					),
				);
			}
			return;
		}

		// Success case - show the diff with colors
		console.log(color(`  ↳ ${toolName} ${duration}`));
		const lines = artifact.patch.split('\n').slice(0, 7);
		for (const line of lines) {
			console.log(`    ${colorizeDiffLine(line)}`);
		}
		if (artifact.patch.split('\n').length > 7) {
			console.log(
				chalk.dim(
					`    … and ${artifact.patch.split('\n').length - 7} more lines`,
				),
			);
		}
		return;
	}

	// For verbose mode, show detailed output for git and ripgrep (truncate to 7 lines)
	if (opts.verbose) {
		if (toolName.startsWith('git_')) {
			console.log(color(`  ↳ ${toolName} ${duration}`));
			if (typeof result === 'object' && result !== null) {
				if ('raw' in result && Array.isArray(result.raw)) {
					const preview = result.raw.slice(0, 7);
					console.log(
						chalk.dim(preview.map((line) => `    ${line}`).join('\n')),
					);
					if (result.raw.length > 7) {
						console.log(chalk.dim(`    … and ${result.raw.length - 7} more`));
					}
					return;
				}
				if ('patch' in result && typeof result.patch === 'string') {
					const lines = result.patch.split('\n').slice(0, 7);
					for (const line of lines) {
						console.log(`    ${colorizeDiffLine(line)}`);
					}
					if (result.patch.split('\n').length > 7) {
						console.log(
							chalk.dim(
								`    … and ${result.patch.split('\n').length - 7} more lines`,
							),
						);
					}
					return;
				}
			}
			return;
		}

		if (toolName === 'ripgrep' || toolName === 'grep' || toolName === 'glob') {
			console.log(color(`  ↳ ${toolName} ${duration}`));
			if (typeof result === 'object' && result !== null) {
				if ('matches' in result && Array.isArray(result.matches)) {
					const count = result.matches.length;
					console.log(
						chalk.dim(`    ${count} ${count === 1 ? 'match' : 'matches'}`),
					);

					const groupedByFile = result.matches.reduce(
						(acc: Record<string, unknown[]>, m: unknown) => {
							if (typeof m === 'object' && m !== null && 'file' in m) {
								const file = String(m.file);
								if (!acc[file]) acc[file] = [];
								acc[file]?.push(m);
							}
							return acc;
						},
						{},
					);

					const files = Object.keys(groupedByFile).slice(0, 5);
					for (const file of files) {
						const matches = groupedByFile[file] || [];
						console.log(chalk.dim(`    ${file} (${matches.length})`));
					}

					const remainingFiles =
						Object.keys(groupedByFile).length - files.length;
					if (remainingFiles > 0) {
						console.log(chalk.dim(`    … and ${remainingFiles} more files`));
					}
					return;
				}
				// Handle glob results (files list)
				if (
					toolName === 'glob' &&
					'files' in result &&
					Array.isArray(result.files)
				) {
					const count = result.files.length;
					console.log(
						chalk.dim(`    ${count} ${count === 1 ? 'file' : 'files'}`),
					);
					const displayFiles = result.files.slice(0, 7);
					for (const file of displayFiles) {
						console.log(chalk.dim(`    ${String(file)}`));
					}
					if (result.files.length > 7) {
						console.log(chalk.dim(`    … and ${result.files.length - 7} more`));
					}
					return;
				}
			}
			return;
		}
	}

	// For all other tools (including finish, read, ls, git_* without verbose, ripgrep without verbose, etc.)
	// Don't show detailed result - they're handled by the condensed done message in run.ts
}
