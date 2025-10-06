import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { expandTilde, isAbsoluteLike, resolveSafePath } from './util.ts';
import DESCRIPTION from './read.txt' with { type: 'text' };

const embeddedTextAssets: Record<string, string> = {};

// description imported above

export function buildReadTool(projectRoot: string): {
	name: string;
	tool: Tool;
} {
	const read = tool({
		description: DESCRIPTION,
		inputSchema: z.object({
			path: z
				.string()
				.describe(
					"File path. Relative to project root by default; absolute ('/...') and home ('~/...') paths are allowed.",
				),
		}),
		async execute({ path }: { path: string }) {
			const req = expandTilde(path);
			if (isAbsoluteLike(req)) {
				const f = Bun.file(req);
				if (await f.exists()) {
					const content = await f.text();
					return { path: req, content, size: content.length };
				}
				throw new Error(`File not found: ${req}`);
			}
			const abs = resolveSafePath(projectRoot, req);
			const f = Bun.file(abs);
			if (await f.exists()) {
				const content = await f.text();
				return { path: req, content, size: content.length };
			}
			const embedded = embeddedTextAssets[req];
			if (embedded) {
				const ef = Bun.file(embedded);
				const content = await ef.text();
				return { path: req, content, size: content.length };
			}
			throw new Error(`File not found: ${req}`);
		},
	});
	return { name: 'read', tool: read };
}
