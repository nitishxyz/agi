import { c, ICONS, formatMs } from './theme.ts';
import type { RendererContext } from './types.ts';
import { renderDiffPreview } from './diff.ts';

export function renderEditCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const path = typeof args.path === 'string' ? args.path : '';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('edit')} ${c.fgDimmed(path)}`;
}

export function renderEditResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const artifact = ctx.artifact as
		| { kind?: string; patch?: string; summary?: Record<string, unknown> }
		| undefined;
	const path = typeof result.path === 'string' ? result.path : '';
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('edit')} ${c.red(ctx.error)} ${c.fgDimmed(time)}`;
	}

	if (result.ok === false && typeof result.error === 'string') {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('edit')} ${c.red(String(result.error))} ${c.fgDimmed(time)}`;
	}

	const lines: string[] = [];
	lines.push(
		`  ${c.green(ICONS.check)} ${c.fgMuted('edit')} ${c.fgDimmed(path)} ${c.fgDimmed(time)}`,
	);

	if (artifact?.kind === 'file_diff' && artifact.patch) {
		lines.push(renderDiffPreview(artifact.patch));
	}

	return lines.join('\n');
}

export function renderMultiEditCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const path = typeof args.path === 'string' ? args.path : '';
	const edits = Array.isArray(args.edits) ? args.edits.length : 0;
	const label = edits > 0 ? `${edits} edits` : '';
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('multiedit')} ${c.fgDimmed(path)} ${c.fgDimmed(label)}`.trimEnd();
}

export function renderMultiEditResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const artifact = ctx.artifact as
		| { kind?: string; patch?: string; summary?: Record<string, unknown> }
		| undefined;
	const path = typeof result.path === 'string' ? result.path : '';
	const editsApplied =
		typeof result.editsApplied === 'number' ? result.editsApplied : 0;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('multiedit')} ${c.red(ctx.error)} ${c.fgDimmed(time)}`;
	}

	if (result.ok === false && typeof result.error === 'string') {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('multiedit')} ${c.red(String(result.error))} ${c.fgDimmed(time)}`;
	}

	const lines: string[] = [];
	const meta = [path, editsApplied > 0 ? `${editsApplied} edits` : '', time]
		.filter(Boolean)
		.join(' ');
	lines.push(
		`  ${c.green(ICONS.check)} ${c.fgMuted('multiedit')} ${c.fgDimmed(meta)}`,
	);

	if (artifact?.kind === 'file_diff' && artifact.patch) {
		lines.push(renderDiffPreview(artifact.patch));
	}

	return lines.join('\n');
}

export function renderCopyIntoCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const sourcePath = typeof args.sourcePath === 'string' ? args.sourcePath : '';
	const targetPath = typeof args.targetPath === 'string' ? args.targetPath : '';
	const startLine = typeof args.startLine === 'number' ? args.startLine : '?';
	const endLine = typeof args.endLine === 'number' ? args.endLine : '?';
	const label = `${sourcePath}:${startLine}-${endLine} → ${targetPath}`;
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('copy_into')} ${c.fgDimmed(label)}`.trimEnd();
}

export function renderCopyIntoResult(ctx: RendererContext): string {
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const artifact = ctx.artifact as
		| { kind?: string; patch?: string; summary?: Record<string, unknown> }
		| undefined;
	const targetPath =
		typeof result.targetPath === 'string' ? result.targetPath : '';
	const linesCopied =
		typeof result.linesCopied === 'number' ? result.linesCopied : 0;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('copy_into')} ${c.red(ctx.error)} ${c.fgDimmed(time)}`;
	}

	if (result.ok === false && typeof result.error === 'string') {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('copy_into')} ${c.red(String(result.error))} ${c.fgDimmed(time)}`;
	}

	const lines: string[] = [];
	const meta = [targetPath, linesCopied > 0 ? `${linesCopied} lines` : '', time]
		.filter(Boolean)
		.join(' ');
	lines.push(
		`  ${c.green(ICONS.check)} ${c.fgMuted('copy_into')} ${c.fgDimmed(meta)}`,
	);

	if (artifact?.kind === 'file_diff' && artifact.patch) {
		lines.push(renderDiffPreview(artifact.patch));
	}

	return lines.join('\n');
}
