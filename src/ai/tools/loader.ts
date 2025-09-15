import type { Tool } from 'ai';
import { finalizeTool } from '@/ai/tools/builtin/finalize.ts';
import { Glob } from 'bun';

export type DiscoveredTool = { name: string; tool: Tool };

export async function discoverProjectTools(projectRoot: string): Promise<DiscoveredTool[]> {
  const glob = new Glob('.agi/tools/*/tool.ts');
  const tools: DiscoveredTool[] = [];
  for await (const rel of glob.scan({ cwd: projectRoot })) {
    const match = rel.match(/^\.agi\/tools\/([^/]+)\/tool\.ts$/);
    if (!match) continue;
    const name = match[1];
    const fileUrl = new URL(`file://${projectRoot.endsWith('/') ? projectRoot : projectRoot + '/'}${rel}`);
    try {
      const mod = await import(fileUrl.href);
      const t: Tool | undefined = mod.default ?? mod.tool;
      if (t) tools.push({ name, tool: t });
    } catch {
      // ignore invalid tool
    }
  }
  tools.push({ name: 'finalize', tool: finalizeTool });
  return tools;
}
