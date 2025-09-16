import { defaultAgentPrompts } from '@/ai/agents/defaults.ts';

export type AgentConfig = {
  name: string;
  prompt: string;
  tools: string[]; // allowed tool names
};

type AgentsJson = Record<string, { tools?: string[]; prompt?: string }>;

export async function loadAgentsConfig(projectRoot: string): Promise<AgentsJson> {
  const file = `${projectRoot}/.agi/agents.json`.replace(/\\/g, '/');
  const f = Bun.file(file);
  if (!(await f.exists())) return {};
  try {
    const text = await f.text();
    return JSON.parse(text) as AgentsJson;
  } catch {
    return {};
  }
}

export async function resolveAgentConfig(projectRoot: string, name: string): Promise<AgentConfig> {
  const agents = await loadAgentsConfig(projectRoot);
  const entry = agents[name];
  let prompt = defaultAgentPrompts[name] ?? defaultAgentPrompts.general;

  // Project override file (either .agi/agents/<name>/agent.txt or .agi/agents/<name>.txt)
  const overridePathDir = `${projectRoot}/.agi/agents/${name}/agent.txt`.replace(/\\/g, '/');
  const overridePathFlat = `${projectRoot}/.agi/agents/${name}.txt`.replace(/\\/g, '/');
  const fDir = Bun.file(overridePathDir);
  const fFlat = Bun.file(overridePathFlat);
  if (await fDir.exists()) {
    const text = await fDir.text();
    if (text.trim()) prompt = text;
  } else if (await fFlat.exists()) {
    const text = await fFlat.text();
    if (text.trim()) prompt = text;
  }

  // If agents.json provides a 'prompt' field, accept inline content or a relative/absolute path
  if (entry?.prompt) {
    const p = entry.prompt.trim();
    if (p.endsWith('.txt') || p.startsWith('.') || p.startsWith('/')) {
      const pf = Bun.file(`${projectRoot}/${p}`.replace(/\\/g, '/'));
      if (await pf.exists()) {
        const t = await pf.text();
        if (t.trim()) prompt = t;
      }
    } else {
      prompt = p;
    }
  }

  // Default tool access per agent if not explicitly configured
  let tools = (entry?.tools ?? []) as string[];
  if (!entry || !entry.tools) {
    if (name === 'build') {
      tools = ['fs_read', 'fs_write', 'fs_ls', 'fs_tree', 'finalize'];
    } else if (name === 'plan') {
      tools = ['fs_read', 'fs_ls', 'fs_tree', 'finalize'];
    } else if (name === 'commit') {
      tools = ['git_status', 'git_diff', 'git_commit', 'fs_read', 'fs_ls', 'finalize'];
    } else {
      tools = ['finalize'];
    }
  }
  return { name, prompt, tools };
}
