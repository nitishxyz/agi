import { c, ICONS, formatMs, pluralize } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderListCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const path = typeof args.path === 'string' ? args.path : '.';
	return `  ${c.dim(ICONS.spinner)} ${c.blue('ls')} ${c.dim(ICONS.arrow)} ${path}`;
}

export function renderListResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const entries = Array.isArray(result.entries) ? result.entries : [];
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ls error ${c.dim(time)}\n  ${c.red(ctx.error)}`;
	}

	return `  ${c.dim(ICONS.arrow)} ${c.blue('ls')} ${c.dim(ICONS.dot)} ${c.dim(`${entries.length} ${pluralize(entries.length, 'entry', 'entries')}`)} ${c.dim(ICONS.dot)} ${c.dim(time)}`;
}
