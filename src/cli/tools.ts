import { loadConfig } from '@/config/index.ts';
import { resolveAgentConfig } from '@/ai/agents/registry.ts';
import { discoverProjectTools } from '@/ai/tools/loader.ts';
import { box, table } from '@/cli/ui.ts';

export async function runToolsList(opts: { project?: string } = {}) {
	const projectRoot = opts.project ?? process.cwd();
	const cfg = await loadConfig(projectRoot);
	const tools = await discoverProjectTools(cfg.projectRoot);
	const toolNames = tools.map((t) => t.name).sort();
	const agents = await collectAgents(cfg.projectRoot);
	// Build header row: Tool | agents columns
	const headers = ['Tool', ...agents];
	const rows: string[][] = [];
	for (const t of toolNames) {
		const row: string[] = [t];
		for (const a of agents) {
			const acfg = await resolveAgentConfig(cfg.projectRoot, a);
			row.push(acfg.tools.includes(t) ? '✔' : '');
		}
		rows.push(row);
	}
	box('Tools & Agents', []);
	table(headers, rows);
}

async function collectAgents(projectRoot: string): Promise<string[]> {
	// Known defaults plus project-defined ones (from agents.json keys)
	const defaults = ['general', 'build', 'plan', 'git'];
	try {
		const f = Bun.file(`${projectRoot}/.agi/agents.json`);
		const json = (await f.json().catch(() => ({}))) as Record<string, any>;
		const keys = Object.keys(json);
		return Array.from(new Set([...defaults, ...keys]));
	} catch {
		return defaults;
	}
}
