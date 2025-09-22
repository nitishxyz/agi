import { createTwoFilesPatch } from 'diff';

export function normalizePath(p: string) {
	const parts = p.replace(/\\/g, '/').split('/');
	const stack: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') stack.pop();
		else stack.push(part);
	}
	return `/${stack.join('/')}`;
}

export function resolveSafePath(projectRoot: string, p: string) {
	const root = normalizePath(projectRoot);
	const abs = normalizePath(`${root}/${p || '.'}`);
	if (!(abs === root || abs.startsWith(`${root}/`))) {
		throw new Error(`Path escapes project root: ${p}`);
	}
	return abs;
}

export function expandTilde(p: string): string {
	const home = process.env.HOME || process.env.USERPROFILE || '';
	if (!home) return p;
	if (p === '~') return home;
	if (p.startsWith('~/')) return `${home}/${p.slice(2)}`;
	return p;
}

export function isAbsoluteLike(p: string): boolean {
	return p.startsWith('/') || /^[A-Za-z]:[\\/]/.test(p);
}

export async function buildWriteArtifact(
	relPath: string,
	existed: boolean,
	oldText: string,
	newText: string,
) {
	let patch = '';
	try {
		patch = createTwoFilesPatch(
			`a/${relPath}`,
			`b/${relPath}`,
			String(oldText ?? ''),
			String(newText ?? ''),
			'',
			'',
			{ context: 3 },
		);
	} catch {}
	if (!patch || !patch.trim().length) {
		const header = existed ? 'Update File' : 'Add File';
		const oldLines = String(oldText ?? '').split('\n');
		const newLines = String(newText ?? '').split('\n');
		const lines: string[] = [];
		lines.push('*** Begin Patch');
		lines.push(`*** ${header}: ${relPath}`);
		lines.push('@@');
		if (existed) for (const l of oldLines) lines.push(`-${l}`);
		for (const l of newLines) lines.push(`+${l}`);
		lines.push('*** End Patch');
		patch = lines.join('\n');
	}
	const { additions, deletions } = summarizePatchCounts(patch);
	return {
		kind: 'file_diff',
		patch,
		summary: { files: 1, additions, deletions },
	} as const;
}

export function summarizePatchCounts(patch: string): {
	additions: number;
	deletions: number;
} {
	let adds = 0;
	let dels = 0;
	for (const line of String(patch || '').split('\n')) {
		if (
			line.startsWith('+++') ||
			line.startsWith('---') ||
			line.startsWith('diff ')
		)
			continue;
		if (line.startsWith('+')) adds += 1;
		else if (line.startsWith('-')) dels += 1;
	}
	return { additions: adds, deletions: dels };
}
