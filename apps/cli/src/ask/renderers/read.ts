import { c, ICONS, formatMs } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderReadCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const path = typeof args.path === 'string' ? args.path : '';
	const startLine =
		typeof args.startLine === 'number' ? args.startLine : undefined;
	const endLine = typeof args.endLine === 'number' ? args.endLine : undefined;
	const range = startLine && endLine ? `${startLine}-${endLine}` : '';
	const label = range ? `${path}:${range}` : path;
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('read')} ${c.fgDimmed(label)}`;
}

export function renderReadResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const path = typeof result.path === 'string' ? result.path : '';
	const lineRange =
		typeof result.lineRange === 'string' ? result.lineRange : '';
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('read')} ${c.red(ctx.error)} ${c.fgDimmed(time)}`;
	}

	const rangeStr = lineRange ? lineRange.replace('@', '') : '';
	const display = rangeStr ? `${path}:${rangeStr}` : path;

	return `  ${c.green(ICONS.check)} ${c.fgMuted('read')} ${c.fgDimmed(display)} ${c.fgDimmed(time)}`;
}
