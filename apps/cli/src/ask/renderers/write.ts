import { c, ICONS, formatMs } from './theme.ts';
import type { RendererContext } from './types.ts';
import { renderDiffPreview } from './diff.ts';

export function renderWriteCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const path = typeof args.path === 'string' ? args.path : '';
	return `  ${c.dim(ICONS.spinner)} ${c.green('write')} ${c.dim(ICONS.arrow)} ${path}`;
}

export function renderWriteResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const artifact = ctx.artifact as
		| { kind?: string; patch?: string; summary?: Record<string, unknown> }
		| undefined;
	const path = typeof result.path === 'string' ? result.path : '';
	const bytes = typeof result.bytes === 'number' ? result.bytes : 0;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} write error ${c.dim(time)}\n  ${c.red(ctx.error)}`;
	}

	const lines: string[] = [];
	const meta = [bytes > 0 ? `${bytes}b` : '', time]
		.filter(Boolean)
		.join(` ${c.dim(ICONS.dot)} `);
	lines.push(
		`  ${c.dim(ICONS.arrow)} ${c.green('write')} ${c.dim(ICONS.dot)} ${c.dim(path)} ${c.dim(ICONS.dot)} ${c.dim(meta)}`,
	);

	if (artifact?.kind === 'file_diff' && artifact.patch) {
		lines.push(renderDiffPreview(artifact.patch, 5));
	}

	return lines.join('\n');
}
