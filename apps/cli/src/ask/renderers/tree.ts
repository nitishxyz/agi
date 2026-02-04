import { c, ICONS, formatMs, pluralize } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderTreeCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const path = typeof args.path === 'string' ? args.path : '.';
	const depth = typeof args.depth === 'number' ? ` d=${args.depth}` : '';
	return `  ${c.dim(ICONS.spinner)} ${c.cyan('tree')} ${c.dim(ICONS.arrow)} ${path}${c.dim(depth)}`;
}

export function renderTreeResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const tree = typeof result.tree === 'string' ? result.tree : '';
	const items = tree.split('\n').filter((l) => l.length > 0).length;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.cyan('tree')} ${c.red('error')} ${c.dim(time)}`;
	}

	const lines: string[] = [];
	lines.push(
		`  ${c.dim(ICONS.arrow)} ${c.cyan('tree')} ${c.dim(ICONS.dot)} ${c.dim(`${items} ${pluralize(items, 'item')}`)} ${c.dim(ICONS.dot)} ${c.dim(time)}`,
	);

	if (tree) {
		const treeLines = tree.split('\n').slice(0, 5);
		for (const l of treeLines) {
			lines.push(`      ${c.dim(l)}`);
		}
		const total = tree.split('\n').length;
		if (total > 5) {
			lines.push(`      ${c.dim(`${ICONS.ellipsis} ${total - 5} more`)}`);
		}
	}

	return lines.join('\n');
}
