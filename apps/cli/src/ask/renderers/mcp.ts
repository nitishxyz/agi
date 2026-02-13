import { c, ICONS, formatMs, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';

function parseMcpToolName(toolName: string): { server: string; tool: string } {
	const idx = toolName.indexOf('__');
	if (idx === -1) return { server: '', tool: toolName };
	return { server: toolName.slice(0, idx), tool: toolName.slice(idx + 2) };
}

export function isMcpTool(toolName: string): boolean {
	return toolName.includes('__');
}

export function renderMcpCall(ctx: RendererContext): string {
	const { server, tool } = parseMcpToolName(ctx.toolName);
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const argKeys = Object.keys(args);
	const preview =
		argKeys.length > 0
			? truncate(
					argKeys
						.slice(0, 3)
						.map((k) => {
							const v = args[k];
							const val =
								typeof v === 'string' ? truncate(v, 20) : JSON.stringify(v);
							return `${k}=${val}`;
						})
						.join(' '),
					60,
				)
			: '';
	return `  ${c.dim(ICONS.spinner)} ${c.magenta('mcp')} ${c.dim(server)} ${c.dim(ICONS.arrow)} ${c.cyan(tool)} ${c.dim(preview)}`;
}

export function renderMcpResult(ctx: RendererContext): string {
	const { server, tool } = parseMcpToolName(ctx.toolName);
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.magenta('mcp')} ${c.dim(server)} ${c.dim(ICONS.arrow)} ${c.cyan(tool)} ${c.red('error')} ${c.dim(time)}\n      ${c.red(ctx.error)}`;
	}

	const ok = result.ok !== false;
	const status = ok ? c.green(ICONS.check) : c.red(ICONS.cross);

	const lines: string[] = [];
	lines.push(
		`  ${c.dim(ICONS.arrow)} ${c.magenta('mcp')} ${c.dim(server)} ${c.dim(ICONS.arrow)} ${c.cyan(tool)} ${status} ${c.dim(time)}`,
	);

	const resultContent = result.result;
	if (typeof resultContent === 'string' && resultContent.length > 0) {
		const contentLines = resultContent.split('\n').filter((l) => l.length > 0);
		const display = contentLines.slice(0, 4);
		for (const l of display) {
			lines.push(`      ${c.dim(truncate(l, 80))}`);
		}
		if (contentLines.length > 4) {
			lines.push(
				`      ${c.dim(`${ICONS.ellipsis} ${contentLines.length - 4} more lines`)}`,
			);
		}
	} else if (!ok && typeof result.error === 'string') {
		lines.push(`      ${c.red(truncate(result.error, 80))}`);
	}

	return lines.join('\n');
}
