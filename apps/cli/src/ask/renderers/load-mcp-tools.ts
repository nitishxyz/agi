import { c, ICONS, formatMs } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderLoadMcpToolsCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const tools = Array.isArray(args.tools) ? (args.tools as string[]) : [];
	const names = tools.slice(0, 5).join(', ');
	const more = tools.length > 5 ? ` +${tools.length - 5} more` : '';
	return `  ${c.dim(ICONS.spinner)} ${c.magenta('mcp')} ${c.dim('loading')} ${c.cyan(names)}${c.dim(more)}`;
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
		return `  ${c.red(ICONS.cross)} ${c.magenta('mcp')} ${c.dim('load')} ${c.red('error')} ${c.dim(time)}\n      ${c.red(ctx.error)}`;
	}

	const lines: string[] = [];

	if (loaded.length > 0) {
		const names = loaded.join(', ');
		lines.push(
			`  ${c.green(ICONS.check)} ${c.magenta('mcp')} ${c.dim('loaded')} ${c.cyan(names)} ${c.dim(time)}`,
		);
	}

	for (const name of notFound) {
		lines.push(
			`  ${c.red(ICONS.cross)} ${c.magenta('mcp')} ${c.dim('not found')} ${c.red(name)}`,
		);
	}

	if (lines.length === 0) {
		lines.push(
			`  ${c.dim(ICONS.arrow)} ${c.magenta('mcp')} ${c.dim('no tools loaded')} ${c.dim(time)}`,
		);
	}

	return lines.join('\n');
}
