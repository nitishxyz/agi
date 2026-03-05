import { c, ICONS, formatMs } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderLoadMcpToolsCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const tools = Array.isArray(args.tools) ? (args.tools as string[]) : [];
	const names = tools.slice(0, 5).join(', ');
	const more = tools.length > 5 ? ` +${tools.length - 5} more` : '';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('mcp')} ${c.fgDimmed(`loading ${names}`)}${c.fgDimmed(more)}`;
}

export function renderLoadMcpToolsResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const time = formatMs(ctx.durationMs);

	const loaded = Array.isArray(result.loaded)
		? (result.loaded as string[])
		: [];
	const notFound = Array.isArray(result.notFound)
		? (result.notFound as string[])
		: [];

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('mcp')} ${c.red('load error')} ${c.fgDimmed(time)}`;
	}

	const lines: string[] = [];

	if (loaded.length > 0) {
		const names = loaded.join(', ');
		lines.push(
			`  ${c.green(ICONS.check)} ${c.fgMuted('mcp')} ${c.fgDimmed(`loaded ${names}`)} ${c.fgDimmed(time)}`,
		);
	}

	for (const name of notFound) {
		lines.push(
			`  ${c.red(ICONS.cross)} ${c.fgDark('mcp')} ${c.red(`not found: ${name}`)}`,
		);
	}

	if (lines.length === 0) {
		lines.push(
			`  ${c.fgDark(ICONS.arrow)} ${c.fgDark('mcp')} ${c.fgDimmed('no tools loaded')} ${c.fgDimmed(time)}`,
		);
	}

	return lines.join('\n');
}
