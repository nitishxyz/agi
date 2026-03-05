import { c, ICONS, formatMs, pluralize, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderSearchCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const query = typeof args.query === 'string' ? args.query : '';
	const pattern = typeof args.pattern === 'string' ? args.pattern : '';
	const term = query || pattern;
	const name = ctx.toolName === 'glob' ? 'glob' : 'search';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark(name)} ${c.fgDimmed(`"${truncate(term, 40)}"`)}`;
}

export function renderSearchResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const matches = Array.isArray(result.matches) ? result.matches : [];
	const files = Array.isArray(result.files) ? result.files : [];
	const time = formatMs(ctx.durationMs);
	const name = ctx.toolName === 'glob' ? 'glob' : 'search';

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark(name)} ${c.red(ctx.error)} ${c.fgDimmed(time)}`;
	}

	const count = matches.length || files.length;
	const label =
		matches.length > 0
			? pluralize(count, 'match', 'matches')
			: pluralize(count, 'file');

	return `  ${c.green(ICONS.check)} ${c.fgMuted(name)} ${c.fgDimmed(`${count} ${label}`)} ${c.fgDimmed(time)}`;
}
