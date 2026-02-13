import { c, ICONS, formatMs, pluralize, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderSearchCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const query = typeof args.query === 'string' ? args.query : '';
	const pattern = typeof args.pattern === 'string' ? args.pattern : '';
	const term = query || pattern;
	const name = ctx.toolName === 'glob' ? 'glob' : 'search';
	const color = ctx.toolName === 'glob' ? c.cyan : c.blue;
	return `  ${c.dim(ICONS.spinner)} ${color(name)} ${c.dim(ICONS.arrow)} ${c.dim(`"${truncate(term, 40)}"`)}`;
}

export function renderSearchResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const matches = Array.isArray(result.matches) ? result.matches : [];
	const files = Array.isArray(result.files) ? result.files : [];
	const time = formatMs(ctx.durationMs);
	const name = ctx.toolName === 'glob' ? 'glob' : 'search';
	const color = ctx.toolName === 'glob' ? c.cyan : c.blue;

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${name} error ${c.dim(time)}\n  ${c.red(ctx.error)}`;
	}

	const count = matches.length || files.length;
	const label =
		matches.length > 0
			? pluralize(count, 'match', 'matches')
			: pluralize(count, 'file');

	return `  ${c.dim(ICONS.arrow)} ${color(name)} ${c.dim(ICONS.dot)} ${c.dim(`${count} ${label}`)} ${c.dim(ICONS.dot)} ${c.dim(time)}`;
}
