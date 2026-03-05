import { c, ICONS, formatMs } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderSkillCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const name = typeof args.name === 'string' ? args.name : '';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('skill')} ${c.fgDimmed(name)}`;
}

export function renderSkillResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const time = formatMs(ctx.durationMs);

	if (result.ok === false) {
		const error =
			typeof result.error === 'string' ? result.error : 'unknown error';
		return `  ${c.red(ICONS.cross)} ${c.fgDark('skill')} ${c.red(error)} ${c.fgDimmed(time)}`;
	}

	const name = typeof result.name === 'string' ? result.name : '';
	return `  ${c.green(ICONS.check)} ${c.fgMuted('skill')} ${c.fgDimmed(name)} ${c.fgDimmed(time)}`;
}
