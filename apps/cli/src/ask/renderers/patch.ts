import { c, ICONS, formatMs } from './theme.ts';
import type { RendererContext } from './types.ts';
import { renderDiffPreview, renderDiffSummary } from './diff.ts';

export function renderPatchCall(ctx: RendererContext): string {
	const args = (ctx.args ?? {}) as Record<string, unknown>;
	const patch = typeof args.patch === 'string' ? args.patch : '';
	const files = patch.match(/\*\*\* (?:Update|Add|Delete) File: (.+)/g) ?? [];
	const fileNames = files.map((f) =>
		f.replace(/\*\*\* (?:Update|Add|Delete) File: /, ''),
	);
	const label =
		fileNames.length === 1 ? fileNames[0] : `${fileNames.length} files`;
	return `  ${c.dim(ICONS.spinner)} ${c.green('patch')} ${c.dim(ICONS.arrow)} ${label ?? 'patch'}`;
}

export function renderPatchResult(ctx: RendererContext): string {
	const artifact = ctx.artifact as
		| {
				kind?: string;
				patch?: string;
				summary?: { files?: number; additions?: number; deletions?: number };
		  }
		| undefined;
	const result = (ctx.result ?? {}) as Record<string, unknown>;
	const time = formatMs(ctx.durationMs);

	if (ctx.error) {
		const lines: string[] = [];
		lines.push(`  ${c.red(ICONS.cross)} patch error ${c.dim(time)}`);
		lines.push(`  ${c.red(ctx.error)}`);
		if (artifact?.patch) {
			lines.push(`  ${c.dim('failed patch:')}`);
			lines.push(renderDiffPreview(artifact.patch, 3));
		}
		return lines.join('\n');
	}

	const hasOkFalse = result.ok === false;
	if (hasOkFalse && typeof result.error === 'string') {
		const lines: string[] = [];
		lines.push(`  ${c.red(ICONS.cross)} patch error ${c.dim(time)}`);
		lines.push(`  ${c.red(String(result.error))}`);
		return lines.join('\n');
	}

	const lines: string[] = [];
	const summary = artifact?.summary;
	const summaryStr = renderDiffSummary(summary);
	const meta = [summaryStr, time].filter(Boolean).join(` ${c.dim(ICONS.dot)} `);
	lines.push(
		`  ${c.dim(ICONS.arrow)} ${c.green('patch')} ${c.dim(ICONS.dot)} ${c.dim(meta)}`,
	);

	if (artifact?.kind === 'file_diff' && artifact.patch) {
		lines.push(renderDiffPreview(artifact.patch, 5));
	}

	return lines.join('\n');
}
