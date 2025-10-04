import chalk from 'chalk';
import type { ToolCallResult } from '@agi-cli/sdk';

export function printToolResult(
	toolName: string,
	result: ToolCallResult,
	durationMs?: number,
): void {
	const duration = durationMs ? chalk.dim(`(${durationMs}ms)`) : '';

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
