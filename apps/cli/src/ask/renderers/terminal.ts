import { c, ICONS, formatMs, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderTerminalCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const op = typeof args.operation === 'string' ? args.operation : '';
	const cmd =
		typeof args.command === 'string' ? truncate(args.command, 40) : '';
	const purpose =
		typeof args.purpose === 'string' ? truncate(args.purpose, 40) : '';
	const label = cmd || purpose || op || 'shell';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('terminal')} ${c.fgDimmed(label)}`;
}

export function renderTerminalResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const op = typeof args.operation === 'string' ? args.operation : '';
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('terminal')} ${c.fgDimmed(op)} ${c.red(truncate(ctx.error, 50))} ${c.fgDimmed(time)}`;
	}

	switch (op) {
		case 'start': {
			const purpose = typeof result.purpose === 'string' ? result.purpose : '';
			const cmd =
				typeof result.command === 'string' ? truncate(result.command, 40) : '';
			const label = cmd || purpose || 'shell';
			return `  ${c.green(ICONS.check)} ${c.fgMuted('terminal')} ${c.fgDimmed('start')} ${c.fgDimmed(label)} ${c.fgDimmed(time)}`;
		}
		case 'read': {
			const output = typeof result.text === 'string' ? result.text : '';
			const lines: string[] = [];
			lines.push(
				`  ${c.green(ICONS.check)} ${c.fgMuted('terminal')} ${c.fgDimmed('read')} ${c.fgDimmed(time)}`,
			);
			if (output) {
				const textLines = output.split('\n').filter((l) => l.length > 0);
				const display = textLines.slice(-3);
				for (const l of display) {
					lines.push(`    ${c.fgDark(truncate(l, 80))}`);
				}
				if (textLines.length > 3) {
					lines.push(
						`    ${c.fgDark(`${ICONS.ellipsis} ${textLines.length - 3} more lines`)}`,
					);
				}
			}
			return lines.join('\n');
		}
		case 'write': {
			const written =
				typeof args.input === 'string'
					? truncate(args.input.replace(/\n/g, '↵'), 40)
					: '';
			return `  ${c.green(ICONS.check)} ${c.fgMuted('terminal')} ${c.fgDimmed('write')} ${c.fgDimmed(written || 'ok')} ${c.fgDimmed(time)}`;
		}
		case 'interrupt':
			return `  ${c.green(ICONS.check)} ${c.fgMuted('terminal')} ${c.fgDimmed('interrupt')} ${c.fgDimmed(time)}`;
		case 'list': {
			const count = typeof result.count === 'number' ? result.count : 0;
			return `  ${c.green(ICONS.check)} ${c.fgMuted('terminal')} ${c.fgDimmed('list')} ${c.fgDimmed(`${count} terminals`)} ${c.fgDimmed(time)}`;
		}
		case 'kill': {
			return `  ${c.green(ICONS.check)} ${c.fgMuted('terminal')} ${c.fgDimmed('kill')} ${c.fgDimmed(time)}`;
		}
		default:
			return `  ${c.green(ICONS.check)} ${c.fgMuted('terminal')} ${c.fgDimmed(op)} ${c.fgDimmed(time)}`;
	}
}
