import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import {
	buildWriteArtifact,
	resolveSafePath,
	expandTilde,
	isAbsoluteLike,
} from './util.ts';
import DESCRIPTION from './write.txt' with { type: 'text' };

// description imported above

export function buildWriteTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const write = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			path: z
				.string()
				.describe(
					'Relative file path within the project. Writes outside the project are not allowed.',
				),
			content: z.string().describe('Text content to write'),
			createDirs: z.boolean().optional().default(true),
		}),
		async execute({
			path,
			content,
			createDirs,
		}: {
			path: string;
			content: string;
			createDirs?: boolean;
		}) {
			const req = expandTilde(path);
			if (isAbsoluteLike(req)) {
				throw new Error(
					`Refusing to write outside project root: ${req}. Use a relative path within the project.`,
				);
			}
			const abs = resolveSafePath(projectRoot, req);
			if (createDirs) {
				const dirPath = abs.slice(0, abs.lastIndexOf('/'));
				await mkdir(dirPath, { recursive: true });
			}
			let existed = false;
			let oldText = '';
			try {
				oldText = await readFile(abs, 'utf-8');
				existed = true;
			} catch {}
			await writeFile(abs, content);
			const artifact = await buildWriteArtifact(req, existed, oldText, content);
			return { path: req, bytes: content.length, artifact } as const;
		},
	});
	return { name: 'write', tool: write };
}
