import { c, ICONS, formatMs } from './theme.ts';
import type { RendererContext } from './types.ts';
import { renderDiffPreview } from './diff.ts';

export function renderWriteCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const path =
		typeof args.path === 'string'
			? args.path
			: typeof args.filePath === 'string'
				? args.filePath
				: '';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('write')} ${c.fgDimmed(path)}`;
}

export function renderWriteResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const artifact = ctx.artifact as
		| { kind?: string; patch?: string; summary?: Record<string, unknown> }
		| undefined;
	const path = typeof result.path === 'string' ? result.path : '';
	const time = formatMs(ctx.durationMs);
	const name = 'write';

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark(name)} ${c.red(ctx.error)} ${c.fgDimmed(time)}`;
	}

	const lines: string[] = [];
	lines.push(
		`  ${c.green(ICONS.check)} ${c.fgMuted(name)} ${c.fgDimmed(path)} ${c.fgDimmed(time)}`,
	);

	if (artifact?.kind === 'file_diff' && artifact.patch) {
		lines.push(renderDiffPreview(artifact.patch));
	}

	return lines.join('\n');
}
