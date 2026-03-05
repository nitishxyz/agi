import { c, ICONS, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';

const SHIMMER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let shimmerIdx = 0;

export function getSpinner(): string {
	shimmerIdx = (shimmerIdx + 1) % SHIMMER.length;
	return SHIMMER[shimmerIdx];
}

export function renderProgressCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const msg =
		typeof args.message === 'string' ? truncate(args.message, 60) : '';
	const stage = typeof args.stage === 'string' ? args.stage : '';
	const pct = typeof args.pct === 'number' ? args.pct : undefined;
	const pctStr = pct !== undefined ? `${pct}%` : '';
	const stageStr = stage ? c.fgDark(`[${stage}]`) : '';
	return `  ${c.purple(getSpinner())} ${c.purple(msg)} ${stageStr} ${c.fgDark(pctStr)}`.trimEnd();
}

export function renderTodosCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const todos = Array.isArray(args.todos) ? args.todos : [];
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('todos')} ${c.fgDimmed(`${todos.length} items`)}`;
}

export function renderTodosResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const items = Array.isArray(result.items) ? result.items : [];
	if (items.length === 0) return '';

	const note = typeof result.note === 'string' ? result.note : '';
	const lines: string[] = [];

	if (note) {
		lines.push(`  ${c.fgDark(note)}`);
	}

	for (const item of items) {
		let step: string;
		let status: string | undefined;

		if (typeof item === 'string') {
			step = item;
		} else if (
			item &&
			typeof item === 'object' &&
			('step' in item || 'description' in item)
		) {
			step =
				'description' in item ? String(item.description) : String(item.step);
			status = 'status' in item ? String(item.status) : undefined;
		} else {
			continue;
		}

		const icon =
			status === 'completed'
				? c.green(ICONS.check)
				: status === 'in_progress'
					? c.yellow(getSpinner())
					: status === 'cancelled'
						? c.fgDark(ICONS.cross)
						: c.fgDark(ICONS.pending);

		lines.push(
			`  ${icon} ${status === 'completed' ? c.fgDark(step) : c.fgMuted(step)}`,
		);
	}

	return lines.join('\n');
}

export function renderFinishCall(_ctx: RendererContext): string {
	return '';
}

export function renderFinishResult(_ctx: RendererContext): string {
	return '';
}

export function renderGenericCall(ctx: RendererContext): string {
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark(ctx.toolName)}`;
}

export function renderGenericResult(ctx: RendererContext): string {
	const time = ctx.durationMs ? c.fgDimmed(`${ctx.durationMs}ms`) : '';
	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark(ctx.toolName)} ${c.red(ctx.error)} ${time}`;
	}
	return '';
}
