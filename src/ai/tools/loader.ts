import type { Tool } from 'ai';
import { finalizeTool } from '@/ai/tools/builtin/finalize.ts';
import { buildFsTools } from '@/ai/tools/builtin/fs.ts';
import { buildGitTools } from '@/ai/tools/builtin/git.ts';
import { Glob } from 'bun';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type DiscoveredTool = { name: string; tool: Tool };

function sanitizeName(name: string) {
	const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
	return cleaned || 'tool';
}

export async function discoverProjectTools(
	projectRoot: string,
): Promise<DiscoveredTool[]> {
	const tools = new Map<string, Tool>();
	// Built-in tools: allow overrides by setting later values on the map
	for (const { name, tool } of buildFsTools(projectRoot)) tools.set(name, tool);
	for (const { name, tool } of buildGitTools(projectRoot))
		tools.set(name, tool);
	tools.set('finalize', finalizeTool);

	async function loadFromBase(base: string | null | undefined) {
		if (!base) return;
		const glob = new Glob('.agi/tools/*/tool.ts');
		for await (const rel of glob.scan({ cwd: base })) {
			const match = rel.match(/^\.agi\/tools\/([^/]+)\/tool\.ts$/);
			if (!match) continue;
			const name = sanitizeName(match[1]);
			const absPath = join(base, rel);
			try {
				const mod = await import(pathToFileURL(absPath).href);
				const t: Tool | undefined = mod.default ?? mod.tool;
				if (t) tools.set(name, t);
			} catch {
				// ignore invalid tool
			}
		}
	}

	const home = process.env.HOME || process.env.USERPROFILE || '';
	await loadFromBase(home || null);
	await loadFromBase(projectRoot);
	return Array.from(tools.entries()).map(([name, tool]) => ({ name, tool }));
}
