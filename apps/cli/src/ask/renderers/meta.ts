import { c, ICONS, truncate } from './theme.ts';
import type { RendererContext } from './types.ts';

export function renderProgressCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const msg =
		typeof args.message === 'string' ? truncate(args.message, 60) : '';
	const stage = typeof args.stage === 'string' ? args.stage : '';
	const pct = typeof args.pct === 'number' ? args.pct : undefined;
	const pctStr = pct !== undefined ? `${pct}%` : '';
	const stageStr = stage ? c.dim(`[${stage}]`) : '';
	return `  ${c.cyan(ICONS.spinner)} ${msg} ${stageStr} ${c.dim(pctStr)}`.trimEnd();
}

export function renderTodosCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const todos = Array.isArray(args.todos) ? args.todos : [];
	return `  ${c.dim(ICONS.spinner)} ${c.cyan('todos')} ${c.dim(ICONS.arrow)} ${c.dim(`${todos.length} items`)}`;
}

export function renderTodosResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const items = Array.isArray(result.items) ? result.items : [];
	if (items.length === 0) return '';

	const note = typeof result.note === 'string' ? result.note : '';
	const lines: string[] = [];

	if (note) {
		lines.push(`  ${c.dim(note)}`);
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
					? c.yellow(ICONS.spinner)
					: status === 'cancelled'
						? c.dim(ICONS.cross)
						: c.dim(ICONS.pending);

		lines.push(`  ${icon} ${status === 'completed' ? c.dim(step) : step}`);
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
	return `  ${c.dim(ICONS.spinner)} ${c.cyan(ctx.toolName)}`;
}

export function renderGenericResult(ctx: RendererContext): string {
	const time = ctx.durationMs ? c.dim(`(${ctx.durationMs}ms)`) : '';
	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${ctx.toolName} error ${time}\n  ${c.red(ctx.error)}`;
	}
	return '';
}
