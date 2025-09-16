import type { Tool } from 'ai';
import { finalizeTool } from '@/ai/tools/builtin/finalize.ts';
import { buildFsTools } from '@/ai/tools/builtin/fs.ts';
import { buildGitTools } from '@/ai/tools/builtin/git.ts';
import { Glob } from 'bun';

export type DiscoveredTool = { name: string; tool: Tool };

function sanitizeName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || 'tool';
}

export async function discoverProjectTools(projectRoot: string): Promise<DiscoveredTool[]> {
  const glob = new Glob('.agi/tools/*/tool.ts');
  const tools: DiscoveredTool[] = [];
  // Built-in tools
  for (const t of buildFsTools(projectRoot)) tools.push(t);
  for (const t of buildGitTools(projectRoot)) tools.push(t);
  tools.push({ name: 'finalize', tool: finalizeTool });
  for await (const rel of glob.scan({ cwd: projectRoot })) {
    const match = rel.match(/^\.agi\/tools\/([^/]+)\/tool\.ts$/);
    if (!match) continue;
    const name = sanitizeName(match[1]);
    const fileUrl = new URL(`file://${projectRoot.endsWith('/') ? projectRoot : projectRoot + '/'}${rel}`);
    try {
      const mod = await import(fileUrl.href);
      const t: Tool | undefined = mod.default ?? mod.tool;
      if (t) tools.push({ name, tool: t });
    } catch {
      // ignore invalid tool
    }
  }
  return tools;
}
