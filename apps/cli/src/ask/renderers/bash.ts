import { c, ICONS, formatMs, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderBashCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const cmd = typeof args.cmd === 'string' ? truncate(args.cmd, 60) : '';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('shell')} ${c.fgDimmed(cmd)}`;
}

export function renderBashResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const cmd =
		typeof args.cmd === 'string'
			? truncate(args.cmd, 60)
			: typeof args.command === 'string'
				? truncate(args.command as string, 60)
				: '';
	const stdout = typeof result.stdout === 'string' ? result.stdout : '';
	const stderr = typeof result.stderr === 'string' ? result.stderr : '';
	const exitCode = typeof result.exitCode === 'number' ? result.exitCode : 0;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('shell')} ${c.fgDimmed(cmd)} ${c.red(truncate(ctx.error, 60))} ${c.fgDimmed(time)}`;
	}

	const lines: string[] = [];
	const icon =
		exitCode === 0
			? c.green(ICONS.check)
			: c.red(`${ICONS.cross} exit ${exitCode}`);
	lines.push(
		`  ${icon} ${c.fgMuted('shell')} ${c.fgDimmed(cmd)} ${c.fgDimmed(time)}`,
	);

	if (stdout) {
		const stdoutLines = stdout.split('\n').filter((l) => l.length > 0);
		const display = stdoutLines.slice(0, 4);
		for (const l of display) {
			lines.push(`    ${c.fgDark(truncate(l, 80))}`);
		}
		if (stdoutLines.length > 4) {
			lines.push(
				`    ${c.fgDark(`${ICONS.ellipsis} ${stdoutLines.length - 4} more lines`)}`,
			);
		}
	}

	if (stderr && exitCode !== 0) {
		const stderrLines = stderr.split('\n').filter((l) => l.length > 0);
		const display = stderrLines.slice(0, 3);
		for (const l of display) {
			lines.push(`    ${c.red(truncate(l, 80))}`);
		}
		if (stderrLines.length > 3) {
			lines.push(
				`    ${c.red(`${ICONS.ellipsis} ${stderrLines.length - 3} more lines`)}`,
			);
		}
	}

	return lines.join('\n');
}
