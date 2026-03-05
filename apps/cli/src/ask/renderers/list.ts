import { c, ICONS, formatMs, pluralize } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderListCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const path = typeof args.path === 'string' ? args.path : '.';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('ls')} ${c.fgDimmed(path)}`;
}

export function renderListResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const entries = Array.isArray(result.entries) ? result.entries : [];
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('ls')} ${c.red(ctx.error)} ${c.fgDimmed(time)}`;
	}

	return `  ${c.green(ICONS.check)} ${c.fgMuted('ls')} ${c.fgDimmed(`${entries.length} ${pluralize(entries.length, 'entry', 'entries')}`)} ${c.fgDimmed(time)}`;
}
