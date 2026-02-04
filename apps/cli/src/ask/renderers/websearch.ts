import { c, ICONS, formatMs, truncate, pluralize } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderWebSearchCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const query =
		typeof args.query === 'string' ? `"${truncate(args.query, 40)}"` : '';
	const url = typeof args.url === 'string' ? truncate(args.url, 50) : '';
	return `  ${c.dim(ICONS.spinner)} ${c.magenta('web')} ${c.dim(ICONS.arrow)} ${query || url}`;
}

export function renderWebSearchResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.magenta('web')} ${c.red('error')} ${c.dim(time)}`;
	}

	if ('results' in result && Array.isArray(result.results)) {
		const count = result.results.length;
		const lines: string[] = [];
		lines.push(
			`  ${c.dim(ICONS.arrow)} ${c.magenta('web')} ${c.dim(ICONS.dot)} ${c.dim(`${count} ${pluralize(count, 'result')}`)} ${c.dim(ICONS.dot)} ${c.dim(time)}`,
		);

		const display = result.results.slice(0, 3) as Array<{
			title?: string;
			url?: string;
		}>;
		for (const r of display) {
			if (r.title) {
				lines.push(`      ${c.white(truncate(String(r.title), 68))}`);
			}
			if (r.url) {
				lines.push(`      ${c.dim(truncate(String(r.url), 68))}`);
			}
		}
		if (count > 3) {
			lines.push(`      ${c.dim(`${ICONS.ellipsis} ${count - 3} more`)}`);
		}
		return lines.join('\n');
	}

	if ('content' in result) {
		const content = typeof result.content === 'string' ? result.content : '';
		const charCount = content.length;
		const lineCount = content.split('\n').length;
		return `  ${c.dim(ICONS.arrow)} ${c.magenta('web')} ${c.dim(ICONS.dot)} ${c.dim(`${charCount.toLocaleString()} chars ${ICONS.dot} ${lineCount} lines`)} ${c.dim(ICONS.dot)} ${c.dim(time)}`;
	}

	return `  ${c.dim(ICONS.arrow)} ${c.magenta('web')} ${c.dim(time)}`;
}
