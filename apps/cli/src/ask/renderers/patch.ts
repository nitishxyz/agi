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
	return `  ${c.fgDark(ICONS.arrow)} ${c.fgDark('patch')} ${c.fgDimmed(label ?? 'patch')}`;
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
		lines.push(
			`  ${c.red(ICONS.cross)} ${c.fgDark('patch')} ${c.red(ctx.error)} ${c.fgDimmed(time)}`,
		);
		if (artifact?.patch) {
			lines.push(renderDiffPreview(artifact.patch, 3));
		}
		return lines.join('\n');
	}

	const hasOkFalse = result.ok === false;
	if (hasOkFalse && typeof result.error === 'string') {
		return `  ${c.red(ICONS.cross)} ${c.fgDark('patch')} ${c.red(String(result.error))} ${c.fgDimmed(time)}`;
	}

	const lines: string[] = [];
	const summary = artifact?.summary;
	const summaryStr = renderDiffSummary(summary);
	const meta = [summaryStr, time].filter(Boolean).join(' ');
	lines.push(
		`  ${c.green(ICONS.check)} ${c.fgMuted('patch')} ${c.fgDimmed(meta)}`,
	);

	if (artifact?.kind === 'file_diff' && artifact.patch) {
		lines.push(renderDiffPreview(artifact.patch));
	}

	return lines.join('\n');
}
