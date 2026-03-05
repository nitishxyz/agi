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
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark(`${server} › ${tool}`)}`;
}

export function renderMcpResult(ctx: RendererContext): string {
	const { server, tool } = parseMcpToolName(ctx.toolName);
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark(`${server} › ${tool}`)} ${c.red(truncate(ctx.error, 50))} ${c.fgDimmed(time)}`;
	}

	const ok = result.ok !== false;
	const icon = ok ? c.green(ICONS.check) : c.red(ICONS.cross);

	const lines: string[] = [];
	lines.push(
		`  ${icon} ${c.fgMuted(`${server} › ${tool}`)} ${c.fgDimmed(time)}`,
	);

	if (!ok && typeof result.error === 'string') {
		lines.push(`    ${c.red(truncate(result.error, 80))}`);
	}

	return lines.join('\n');
}
