import chalk from 'chalk';
import type { ToolCallResult, Artifact } from '@agi-cli/sdk';
import type { ToolResultRecord, ToolCallRecord, TokenUsageSummary } from './types.ts';

// Export color utilities
export const dim = chalk.dim;
export const bold = chalk.bold;

// Print a tool call
export function printToolCall(
	toolName: string,
	args: unknown,
	opts: { verbose?: boolean } = {},
): void {
	const argsStr = args && typeof args === 'object' 
		? JSON.stringify(args, null, 2) 
		: String(args);
	
	if (opts.verbose) {
		console.log(chalk.cyan(`  ▶ ${toolName}`));
		if (args) {
			const lines = argsStr.split('\n');
			for (const line of lines) {
				console.log(chalk.dim(`    ${line}`));
			}
		}
	} else {
		const preview = argsStr.length > 80 
			? argsStr.slice(0, 80) + '...' 
			: argsStr;
		console.log(chalk.cyan(`  ▶ ${toolName} ${chalk.dim(preview)}`));
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
export function printPlan(
	items: unknown,
	note?: string,
): void {
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
		
		const statusIcon = status === 'completed' 
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
	toolResults: ToolResultRecord[],
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
	const filesArray = Array.isArray(filesTouched) ? filesTouched : Array.from(filesTouched);
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

	// Handle errors first
	if (opts.error) {
		console.log(chalk.red(`  ✗ ${toolName} error ${duration}`));
		console.log(chalk.red(`    ${opts.error}`));
		return;
	}

	// Handle websearch results
	if (toolName === 'websearch') {
		if ('error' in result) {
			// Error result
			console.log(
				chalk.red(`  ✗ websearch error ${duration}`),
			);
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
			// Search results
			const resultCount = result.count || result.results?.length || 0;
			console.log(
				chalk.magenta(
					`  ↳ websearch "${result.query}" · ${resultCount} ${resultCount === 1 ? 'result' : 'results'} ${duration}`,
				),
			);

			if (result.results && result.results.length > 0) {
				const displayCount = Math.min(5, result.results.length);
				console.log();

				for (let i = 0; i < displayCount; i++) {
					const r = result.results[i];
					if (!r) continue;

					console.log(chalk.bold(`    ${i + 1}. ${r.title}`));
					
					if (r.snippet) {
						const snippet =
							r.snippet.length > 200
								? r.snippet.slice(0, 200) + '...'
								: r.snippet;
						console.log(chalk.dim(`       ${snippet}`));
					}
					
					console.log(chalk.cyan(`       ${r.url}`));
					
					if (i < displayCount - 1) {
						console.log();
					}
				}

				if (result.results.length > displayCount) {
					console.log();
					console.log(
						chalk.dim(
							`    … and ${result.results.length - displayCount} more ${result.results.length - displayCount === 1 ? 'result' : 'results'}`,
						),
					);
				}
			} else {
				console.log(chalk.dim('    No results found'));
			}
			return;
		}

		if ('content' in result && 'url' in result) {
			// URL fetch result
			const charCount = result.contentLength?.toLocaleString() || 'unknown';
			const lineCount = result.content
				? result.content.split('\n').length.toLocaleString()
				: 'unknown';
			const truncated = result.truncated ? chalk.yellow('(truncated)') : '';

			console.log(
				chalk.cyan(
					`  ↳ websearch ${result.url} · ${charCount} chars · ${lineCount} lines ${truncated} ${duration}`,
				),
			);

			if (result.contentType) {
				console.log(chalk.dim(`    Content-Type: ${result.contentType}`));
			}

			if (result.content) {
				const lines = result.content.split('\n');
				const displayLines = Math.min(15, lines.length);
				console.log();
				console.log(chalk.dim('    ┌─ Content Preview'));
				for (let i = 0; i < displayLines; i++) {
					const line = lines[i];
					if (line !== undefined) {
						console.log(chalk.dim(`    │ ${line}`));
					}
				}
				if (lines.length > displayLines) {
					console.log(
						chalk.dim(
							`    └─ … and ${lines.length - displayLines} more ${lines.length - displayLines === 1 ? 'line' : 'lines'}`,
						),
					);
				} else {
					console.log(chalk.dim('    └─'));
				}
			}
			return;
		}
	}

	// Handle bash results
	if (toolName === 'bash') {
		if ('stdout' in result || 'stderr' in result) {
			const code = 'exitCode' in result ? result.exitCode : undefined;
			const status =
				code === 0 ? chalk.green('✓') : code ? chalk.red(`✗ (${code})`) : '';
			console.log(chalk.cyan(`  ↳ bash ${status} ${duration}`));
			if (result.stdout) {
				const preview =
					result.stdout.length > 500
						? result.stdout.slice(0, 500) + '\n…'
						: result.stdout;
				console.log(chalk.dim(preview.split('\n').map((l) => `    ${l}`).join('\n')));
			}
			if (result.stderr) {
				const preview =
					result.stderr.length > 500
						? result.stderr.slice(0, 500) + '\n…'
						: result.stderr;
				console.log(chalk.red(preview.split('\n').map((l) => `    ${l}`).join('\n')));
			}
			return;
		}
	}

	// Handle git results
	if (toolName.startsWith('git_')) {
		console.log(chalk.cyan(`  ↳ ${toolName} ${duration}`));
		if (typeof result === 'object' && result !== null) {
			if ('raw' in result && Array.isArray(result.raw)) {
				const preview = result.raw.slice(0, 10);
				console.log(
					chalk.dim(preview.map((line) => `    ${line}`).join('\n')),
				);
				if (result.raw.length > 10) {
					console.log(chalk.dim(`    … and ${result.raw.length - 10} more`));
				}
				return;
			}
			if ('patch' in result && typeof result.patch === 'string') {
				const lines = result.patch.split('\n').slice(0, 20);
				console.log(chalk.dim(lines.map((l) => `    ${l}`).join('\n')));
				if (result.patch.split('\n').length > 20) {
					console.log(
						chalk.dim(
							`    … and ${result.patch.split('\n').length - 20} more lines`,
						),
					);
				}
				return;
			}
		}
	}

	// Handle ripgrep results
	if (toolName === 'ripgrep') {
		console.log(chalk.cyan(`  ↳ ${toolName} ${duration}`));
		if (typeof result === 'object' && result !== null) {
			if ('matches' in result && Array.isArray(result.matches)) {
				const count = result.matches.length;
				console.log(chalk.dim(`    ${count} ${count === 1 ? 'match' : 'matches'}`));
				
				const groupedByFile = result.matches.reduce((acc: Record<string, unknown[]>, m: unknown) => {
					if (typeof m === 'object' && m !== null && 'file' in m) {
						const file = String(m.file);
						if (!acc[file]) acc[file] = [];
						acc[file]!.push(m);
					}
					return acc;
				}, {});
				
				const files = Object.keys(groupedByFile).slice(0, 5);
				for (const file of files) {
					const matches = groupedByFile[file] || [];
					console.log(chalk.dim(`    ${file} (${matches.length})`));
				}
				
				const remainingFiles = Object.keys(groupedByFile).length - files.length;
				if (remainingFiles > 0) {
					console.log(chalk.dim(`    … and ${remainingFiles} more files`));
				}
				return;
			}
		}
	}

	// Generic fallback
	console.log(chalk.cyan(`  ↳ ${toolName} ${duration}`));
	if (typeof result === 'object' && result !== null) {
		const preview = JSON.stringify(result, null, 2)
			.split('\n')
			.slice(0, 10)
			.map((l) => `    ${l}`)
			.join('\n');
		console.log(chalk.dim(preview));
		const totalLines = JSON.stringify(result, null, 2).split('\n').length;
		if (totalLines > 10) {
			console.log(chalk.dim(`    … and ${totalLines - 10} more lines`));
		}
	} else {
		console.log(chalk.dim(`    ${String(result)}`));
	}
}
