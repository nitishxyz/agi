import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { $ } from 'bun';
import DESCRIPTION from './patch.txt' with { type: 'text' };

/**
 * Apply enveloped patch by directly modifying files
 */
async function applyEnvelopedPatch(projectRoot: string, patch: string) {
	const lines = patch.split('\n');
	let currentFile: string | null = null;
	let operation: 'add' | 'update' | 'delete' | null = null;
	let fileContent: string[] = [];

	async function applyCurrentFile() {
		if (!currentFile || !operation) return { ok: true };

		const fullPath = `${projectRoot}/${currentFile}`;

		if (operation === 'delete') {
			try {
				await Bun.write(fullPath, '');
			} catch (e) {
				return {
					ok: false,
					error: `Failed to delete ${currentFile}: ${e instanceof Error ? e.message : String(e)}`,
				};
			}
		} else if (operation === 'add') {
			// For add, only use lines starting with +
			const newContent = fileContent
				.filter((l) => l.startsWith('+'))
				.map((l) => l.substring(1))
				.join('\n');
			try {
				await Bun.write(fullPath, newContent);
			} catch (e) {
				return {
					ok: false,
					error: `Failed to create ${currentFile}: ${e instanceof Error ? e.message : String(e)}`,
				};
			}
		} else if (operation === 'update') {
			try {
				// Read existing file
				let existingContent = '';
				try {
					const file = Bun.file(fullPath);
					existingContent = await file.text();
				} catch {
					// File doesn't exist yet
				}

				// Get the old content (lines starting with -)
				const oldLines = fileContent
					.filter((l) => l.startsWith('-'))
					.map((l) => l.substring(1));

				// Get the new content (lines starting with +)
				const newLines = fileContent
					.filter((l) => l.startsWith('+'))
					.map((l) => l.substring(1));

				// Simple replacement: if old content is empty, append
				// Otherwise try to replace old with new
				let newContent = existingContent;
				if (oldLines.length > 0) {
					const oldText = oldLines.join('\n');
					const newText = newLines.join('\n');
					if (existingContent.includes(oldText)) {
						newContent = existingContent.replace(oldText, newText);
					} else {
						// Can't find exact match, this is where enveloped format fails
						// Provide more context about what couldn't be found
						const preview = oldText.substring(0, 100);
						return {
							ok: false,
							error: `Cannot find content to replace in ${currentFile}. Looking for: "${preview}${oldText.length > 100 ? '...' : ''}"`,
						};
					}
				} else if (newLines.length > 0) {
					// Just appending new lines
					newContent =
						existingContent +
						(existingContent.endsWith('\n') ? '' : '\n') +
						newLines.join('\n');
				}

				await Bun.write(fullPath, newContent);
			} catch (e) {
				return {
					ok: false,
					error: `Failed to update ${currentFile}: ${e instanceof Error ? e.message : String(e)}`,
				};
			}
		}
		return { ok: true };
	}

	for (const line of lines) {
		if (line === '*** Begin Patch' || line === '*** End Patch') {
			continue;
		}

		if (
			line.startsWith('*** Add File:') ||
			line.startsWith('*** Update File:') ||
			line.startsWith('*** Delete File:')
		) {
			// Apply previous file if any
			const result = await applyCurrentFile();
			if (!result.ok) return result;

			// Start new file
			if (line.startsWith('*** Add File:')) {
				currentFile = line.replace('*** Add File:', '').trim();
				operation = 'add';
			} else if (line.startsWith('*** Update File:')) {
				currentFile = line.replace('*** Update File:', '').trim();
				operation = 'update';
			} else if (line.startsWith('*** Delete File:')) {
				currentFile = line.replace('*** Delete File:', '').trim();
				operation = 'delete';
			}
			fileContent = [];
		} else if (
			currentFile &&
			(line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))
		) {
			// Collect patch content lines
			fileContent.push(line);
		}
	}

	// Apply the last file
	const result = await applyCurrentFile();
	return result;
}

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
			// Check if this is an enveloped patch format
			const isEnveloped =
				patch.includes('*** Begin Patch') ||
				patch.includes('*** Add File:') ||
				patch.includes('*** Update File:');

			if (isEnveloped) {
				// Handle enveloped patches directly
				const result = await applyEnvelopedPatch(projectRoot, patch);
				const summary = summarizePatch(patch);
				if (result.ok) {
					return {
						ok: true,
						output: 'Applied enveloped patch',
						artifact: { kind: 'file_diff', patch, summary },
					} as const;
				} else {
					return {
						ok: false,
						error: result.error || 'Failed to apply enveloped patch',
						artifact: { kind: 'file_diff', patch, summary },
					} as const;
				}
			}

			// For unified diffs, use git apply as before
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
			let lastError = '';
			for (const args of tries) {
				const cmd = ['git', '-C', projectRoot, ...args, file];
				const proc = await $`${cmd}`.quiet().nothrow();
				const out = await proc.text();
				// Capture error output for later use
				if (proc.exitCode !== 0) {
					lastError = out || `git apply failed with exit code ${proc.exitCode}`;
				}

				// Check if the patch was actually applied by looking at git status
				// Sometimes git apply returns non-zero but the patch is applied
				if (proc.exitCode === 0 || proc.exitCode === 1) {
					// Check if any files were actually modified
					const statusProc = await $`git -C ${projectRoot} status --porcelain`
						.quiet()
						.nothrow();
					const statusOut = await statusProc.text();
					if (statusOut && statusOut.trim().length > 0) {
						// Files were changed, so patch was likely applied
						return {
							ok: true,
							output: out?.trim() ?? '',
							artifact: { kind: 'file_diff', patch, summary },
						} as const;
					}
				}
				// Only continue trying if patch wasn't applied
			}
			// If both attempts fail with exit code, check if files were modified anyway
			// Sometimes git apply exits with warnings but the patch is applied
			const statusProc = await $`git -C ${projectRoot} status --porcelain`
				.quiet()
				.nothrow();
			const statusOut = await statusProc.text();
			if (statusOut && statusOut.trim().length > 0) {
				// Files were changed, so patch was likely applied despite the exit code
				return {
					ok: true,
					output: 'Patch applied with warnings',
					artifact: { kind: 'file_diff', patch, summary },
				} as const;
			}

			// If both attempts fail and no files changed, return error with more context
			const errorDetails = lastError.includes('patch does not apply')
				? 'The patch cannot be applied because the target content has changed or does not match. The file may have been modified since the patch was created.'
				: lastError ||
					'git apply failed (tried -p1 and -p0) — ensure paths match project root';
			return {
				ok: false,
				error: errorDetails,
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
