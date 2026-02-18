import { c, ICONS, formatMs, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderSkillCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const name = typeof args.name === 'string' ? args.name : '';
	return `  ${c.dim(ICONS.spinner)} ${c.magenta('skill')} ${c.dim(ICONS.arrow)} ${name}`;
}

export function renderSkillResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const time = ctx.durationMs ? c.dim(`(${formatMs(ctx.durationMs)})`) : '';

	if (result.ok === false) {
		const error =
			typeof result.error === 'string' ? result.error : 'unknown error';
		return `  ${c.red(ICONS.cross)} skill error ${time}\n  ${c.red(error)}`;
	}

	const name = typeof result.name === 'string' ? result.name : '';
	const desc =
		typeof result.description === 'string'
			? truncate(result.description, 60)
			: '';
	const scope =
		typeof result.scope === 'string' ? c.dim(`[${result.scope}]`) : '';

	return `  ${c.magenta(ICONS.check)} ${c.magenta('skill')} ${c.dim(ICONS.arrow)} ${name} ${scope} ${time}${desc ? `\n  ${c.dim(desc)}` : ''}`.trimEnd();
}
