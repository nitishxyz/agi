import { c, ICONS, formatMs, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderTerminalCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const op = typeof args.operation === 'string' ? args.operation : '';
	const id =
		typeof args.terminalId === 'string' ? truncate(args.terminalId, 12) : '';
	const cmd =
		typeof args.command === 'string' ? truncate(args.command, 40) : '';
	const purpose =
		typeof args.purpose === 'string' ? truncate(args.purpose, 40) : '';
	const input = typeof args.input === 'string' ? truncate(args.input, 40) : '';

	switch (op) {
		case 'start': {
			const label = cmd || purpose || 'shell';
			return `  ${c.dim(ICONS.spinner)} ${c.yellow('terminal')} ${c.dim('start')} ${c.dim(ICONS.arrow)} ${c.dim(label)}`;
		}
		case 'read':
			return `  ${c.dim(ICONS.spinner)} ${c.yellow('terminal')} ${c.dim('read')} ${c.dim(ICONS.arrow)} ${c.dim(id)}`;
		case 'write':
			return `  ${c.dim(ICONS.spinner)} ${c.yellow('terminal')} ${c.dim('write')} ${c.dim(ICONS.arrow)} ${c.dim(input || id)}`;
		case 'interrupt':
			return `  ${c.dim(ICONS.spinner)} ${c.yellow('terminal')} ${c.dim('interrupt')} ${c.dim(ICONS.arrow)} ${c.dim(id)}`;
		case 'list':
			return `  ${c.dim(ICONS.spinner)} ${c.yellow('terminal')} ${c.dim('list')}`;
		case 'kill':
			return `  ${c.dim(ICONS.spinner)} ${c.yellow('terminal')} ${c.dim('kill')} ${c.dim(ICONS.arrow)} ${c.dim(id)}`;
		default:
			return `  ${c.dim(ICONS.spinner)} ${c.yellow('terminal')} ${c.dim(op)}`;
	}
}

export function renderTerminalResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const op = typeof args.operation === 'string' ? args.operation : '';
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.yellow('terminal')} ${c.dim(op)} ${c.red('error')} ${c.dim(time)}\n      ${c.red(ctx.error)}`;
	}

	switch (op) {
		case 'start': {
			const id =
				typeof result.terminalId === 'string'
					? truncate(result.terminalId, 12)
					: '';
			const purpose = typeof result.purpose === 'string' ? result.purpose : '';
			const cmd =
				typeof result.command === 'string' ? truncate(result.command, 40) : '';
			const label = cmd || purpose || 'shell';
			return `  ${c.dim(ICONS.arrow)} ${c.yellow('terminal')} ${c.dim('start')} ${c.green(ICONS.check)} ${c.dim(label)} ${c.dim(ICONS.dot)} ${c.dim(id)} ${c.dim(time)}`;
		}
		case 'read': {
			const lines = typeof result.lines === 'number' ? result.lines : 0;
			const status = typeof result.status === 'string' ? result.status : '';
			const exitCode =
				typeof result.exitCode === 'number' ? result.exitCode : undefined;
			const id =
				typeof result.terminalId === 'string'
					? truncate(result.terminalId, 12)
					: '';
			const statusLabel =
				status === 'running'
					? c.green('running')
					: status === 'exited' && exitCode === 0
						? c.dim('exited')
						: status === 'exited'
							? c.red(`exited ${exitCode}`)
							: c.dim(status);
			const output = typeof result.text === 'string' ? result.text : '';
			const outputLines: string[] = [];
			outputLines.push(
				`  ${c.dim(ICONS.arrow)} ${c.yellow('terminal')} ${c.dim('read')} ${c.dim(ICONS.dot)} ${c.dim(id)} ${c.dim(ICONS.dot)} ${c.dim(`${lines} lines`)} ${c.dim(ICONS.dot)} ${statusLabel} ${c.dim(time)}`,
			);
			if (output) {
				const textLines = output.split('\n').filter((l) => l.length > 0);
				const display = textLines.slice(-4);
				for (const l of display) {
					outputLines.push(`      ${c.dim(truncate(l, 80))}`);
				}
				if (textLines.length > 4) {
					outputLines.push(
						`      ${c.dim(`${ICONS.ellipsis} ${textLines.length - 4} more lines`)}`,
					);
				}
			}
			return outputLines.join('\n');
		}
		case 'write': {
			const written =
				typeof args.input === 'string'
					? truncate(args.input.replace(/\n/g, '↵'), 60)
					: '';
			return `  ${c.dim(ICONS.arrow)} ${c.yellow('terminal')} ${c.dim('write')} ${c.green(ICONS.check)} ${c.dim(written || 'ok')} ${c.dim(time)}`;
		}
		case 'interrupt': {
			return `  ${c.dim(ICONS.arrow)} ${c.yellow('terminal')} ${c.dim('interrupt')} ${c.green(ICONS.check)} ${c.dim(time)}`;
		}
		case 'list': {
			const count = typeof result.count === 'number' ? result.count : 0;
			const terminals = Array.isArray(result.terminals) ? result.terminals : [];
			const lines: string[] = [];
			lines.push(
				`  ${c.dim(ICONS.arrow)} ${c.yellow('terminal')} ${c.dim('list')} ${c.dim(ICONS.dot)} ${c.dim(`${count} terminals`)} ${c.dim(time)}`,
			);
			for (const t of terminals.slice(0, 5) as Array<Record<string, unknown>>) {
				const tid = typeof t.id === 'string' ? truncate(t.id, 12) : '';
				const tpurpose =
					typeof t.purpose === 'string' ? truncate(t.purpose, 40) : '';
				const tstatus = typeof t.status === 'string' ? t.status : '';
				const statusIcon =
					tstatus === 'running' ? c.green(ICONS.check) : c.dim(ICONS.pending);
				lines.push(`      ${statusIcon} ${c.dim(tid)} ${tpurpose}`);
			}
			if (count > 5) {
				lines.push(`      ${c.dim(`${ICONS.ellipsis} ${count - 5} more`)}`);
			}
			return lines.join('\n');
		}
		case 'kill': {
			const id =
				typeof result.terminalId === 'string'
					? truncate(result.terminalId, 12)
					: '';
			return `  ${c.dim(ICONS.arrow)} ${c.yellow('terminal')} ${c.dim('kill')} ${c.green(ICONS.check)} ${c.dim(id)} ${c.dim(time)}`;
		}
		default:
			return `  ${c.dim(ICONS.arrow)} ${c.yellow('terminal')} ${c.dim(op)} ${c.dim(time)}`;
	}
}
