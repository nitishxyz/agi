import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { $ } from 'bun';
import DESCRIPTION from './patch.txt' with { type: 'text' };

export function buildApplyPatchTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const applyPatch = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			patch: z.string().min(1).describe('Unified diff patch content'),
			allowRejects: z
				.boolean()
				.optional()
				.default(false)
				.describe(
					'Allow hunks to be rejected without failing the whole operation',
				),
		}),
		async execute({
			patch,
			allowRejects,
		}: {
			patch: string;
			allowRejects?: boolean;
		}) {
			const dir = `${projectRoot}/.agi/tmp`;
			try {
				await $`mkdir -p ${dir}`;
			} catch {}
			const file = `${dir}/patch-${Date.now()}.diff`;
			await Bun.write(file, patch);
			const summary = summarizePatch(patch);
			// Try -p1 first for canonical git-style patches (a/ b/ prefixes), then fall back to -p0.
			const baseArgs = ['apply', '--whitespace=nowarn'];
			const rejectArg = allowRejects ? ['--reject'] : [];
			const tries: Array<string[]> = [
				[...baseArgs, ...rejectArg, '-p1'],
				[...baseArgs, ...rejectArg, '-p0'],
			];
			for (const args of tries) {
				const cmd = ['git', '-C', projectRoot, ...args, file];
				const proc = await $`${cmd}`.quiet().nothrow();
				const out = await proc.text();
				if (proc.exitCode === 0) {
					return {
						ok: true,
						output: out?.trim() ?? '',
						artifact: { kind: 'file_diff', patch, summary },
					} as const;
				}
			}
			// If both attempts fail, return error output from the last try
			return {
				ok: false,
				error:
					'git apply failed (tried -p1 and -p0) — ensure paths match project root',
				artifact: { kind: 'file_diff', patch, summary },
			} as const;
		},
	});
	return { name: 'apply_patch', tool: applyPatch };
}

function summarizePatch(patch: string) {
	const lines = String(patch || '').split('\n');
	let files = 0;
	let additions = 0;
	let deletions = 0;
	for (const l of lines) {
		if (/^\*\*\*\s+(Add|Update|Delete) File:/.test(l)) files += 1;
		else if (l.startsWith('+') && !l.startsWith('+++')) additions += 1;
		else if (l.startsWith('-') && !l.startsWith('---')) deletions += 1;
	}
	return { files, additions, deletions };
}
