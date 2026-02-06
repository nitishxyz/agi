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
	return `  ${c.dim(ICONS.spinner)} ${c.blue('read')} ${c.dim(ICONS.arrow)} ${label}`;
}

export function renderReadResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const content = typeof result.content === 'string' ? result.content : '';
	const lines = content ? content.split('\n').length : 0;
	const path = typeof result.path === 'string' ? result.path : '';
	const lineRange =
		typeof result.lineRange === 'string' ? result.lineRange : '';
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} read error ${c.dim(time)}\n  ${c.red(ctx.error)}`;
	}

	const rangeStr = lineRange ? lineRange.replace('@', '') : '';
	const display = rangeStr ? `${path}:${rangeStr}` : path;
	const meta = [
		lines > 0 ? `${lines} ${lines === 1 ? 'line' : 'lines'}` : '',
		time,
	]
		.filter(Boolean)
		.join(` ${c.dim(ICONS.dot)} `);

	return `  ${c.dim(ICONS.arrow)} ${c.blue('read')} ${c.dim(ICONS.dot)} ${c.dim(display)} ${c.dim(ICONS.dot)} ${c.dim(meta)}`;
}
