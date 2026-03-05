import { c, ICONS, formatMs, pluralize } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderTreeCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const path = typeof args.path === 'string' ? args.path : '.';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('tree')} ${c.fgDimmed(path)}`;
}

export function renderTreeResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const tree = typeof result.tree === 'string' ? result.tree : '';
	const items = tree.split('\n').filter((l) => l.length > 0).length;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('tree')} ${c.red('error')} ${c.fgDimmed(time)}`;
	}

	return `  ${c.green(ICONS.check)} ${c.fgMuted('tree')} ${c.fgDimmed(`${items} ${pluralize(items, 'item')}`)} ${c.fgDimmed(time)}`;
}
