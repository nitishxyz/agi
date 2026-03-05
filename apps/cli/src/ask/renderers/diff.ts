import { c, ICONS } from './theme.ts';

export function colorizeDiffLine(line: string): string {
	if (line.startsWith('+++') || line.startsWith('---')) return c.fgDark(line);
	if (line.startsWith('+')) return c.diffAddedBg(c.diffAdded(line));
	if (line.startsWith('-')) return c.diffRemovedBg(c.diffRemoved(line));
	if (line.startsWith('@@')) return c.fgDark(line);
	return c.fgDimmed(line);
}

export function renderDiffPreview(patch: string, maxLines = 8): string {
	const allLines = patch.split('\n');
	const meaningful = allLines.filter(
		(l) =>
			l.startsWith('+') ||
			l.startsWith('-') ||
			l.startsWith('@@') ||
			l.startsWith(' '),
	);
	const display = meaningful.slice(0, maxLines);
	const remaining = meaningful.length - display.length;

	const out: string[] = [];
	for (const line of display) {
		out.push(`    ${colorizeDiffLine(line)}`);
	}
	if (remaining > 0) {
		out.push(`    ${c.fgDark(`${ICONS.ellipsis} ${remaining} more changes`)}`);
	}
	return out.join('\n');
}

export function renderDiffSummary(summary?: {
	files?: number;
	additions?: number;
	deletions?: number;
}): string {
	if (!summary) return '';
	const parts: string[] = [];
	if (summary.files)
		parts.push(`${summary.files} ${summary.files === 1 ? 'file' : 'files'}`);
	if (summary.additions) parts.push(c.green(`+${summary.additions}`));
	if (summary.deletions) parts.push(c.red(`-${summary.deletions}`));
	return parts.join(' ');
}
