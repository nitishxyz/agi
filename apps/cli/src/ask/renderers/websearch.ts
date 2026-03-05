import { c, ICONS, formatMs, truncate, pluralize } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderWebSearchCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const query =
		typeof args.query === 'string' ? `"${truncate(args.query, 40)}"` : '';
	const url = typeof args.url === 'string' ? truncate(args.url, 50) : '';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('web')} ${c.fgDimmed(query || url)}`;
}

export function renderWebSearchResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('web')} ${c.red('error')} ${c.fgDimmed(time)}`;
	}

	if ('results' in result && Array.isArray(result.results)) {
		const count = result.results.length;
		return `  ${c.green(ICONS.check)} ${c.fgMuted('web')} ${c.fgDimmed(`${count} ${pluralize(count, 'result')}`)} ${c.fgDimmed(time)}`;
	}

	if ('content' in result) {
		const content = typeof result.content === 'string' ? result.content : '';
		const charCount = content.length;
		return `  ${c.green(ICONS.check)} ${c.fgMuted('web')} ${c.fgDimmed(`${charCount.toLocaleString()} chars`)} ${c.fgDimmed(time)}`;
	}

	return `  ${c.green(ICONS.check)} ${c.fgMuted('web')} ${c.fgDimmed(time)}`;
}
