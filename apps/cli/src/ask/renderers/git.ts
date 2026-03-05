import { c, ICONS, formatMs, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';
import { colorizeDiffLine } from './diff.ts';

export function renderGitStatusCall(_ctx: RendererContext): string {
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('git_status')}`;
}

export function renderGitStatusResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const staged = typeof result.staged === 'number' ? result.staged : 0;
	const unstaged = typeof result.unstaged === 'number' ? result.unstaged : 0;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('git_status')} ${c.red('error')} ${c.fgDimmed(time)}`;
	}

	return `  ${c.green(ICONS.check)} ${c.fgMuted('git_status')} ${c.fgDimmed(`${staged} staged, ${unstaged} unstaged`)} ${c.fgDimmed(time)}`;
}

export function renderGitDiffCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const all = args.all ? ' --all' : '';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('git_diff')}${c.fgDimmed(all)}`;
}

export function renderGitDiffResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const patch = typeof result.patch === 'string' ? result.patch : '';
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('git_diff')} ${c.red('error')} ${c.fgDimmed(time)}`;
	}

	const lines: string[] = [];
	const patchLines = patch.split('\n').length;
	lines.push(
		`  ${c.green(ICONS.check)} ${c.fgMuted('git_diff')} ${c.fgDimmed(`${patchLines} lines`)} ${c.fgDimmed(time)}`,
	);

	if (patch) {
		const display = patch.split('\n').slice(0, 5);
		for (const l of display) {
			lines.push(`    ${colorizeDiffLine(l)}`);
		}
		if (patchLines > 5) {
			lines.push(
				`    ${c.fgDark(`${ICONS.ellipsis} ${patchLines - 5} more lines`)}`,
			);
		}
	}

	return lines.join('\n');
}

export function renderGitCommitCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const msg =
		typeof args.message === 'string'
			? truncate(args.message.split('\n')[0], 50)
			: '';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('git_commit')} ${c.fgDimmed(msg)}`;
}

export function renderGitCommitResult(ctx: RendererContext): string {
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('git_commit')} ${c.red('error')} ${c.fgDimmed(time)}`;
	}

	return `  ${c.green(ICONS.check)} ${c.fgMuted('git_commit')} ${c.fgDimmed(time)}`;
}
