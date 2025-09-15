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

  // Project override file: .agi/agents/<name>/agent.txt
  const overridePath = `${projectRoot}/.agi/agents/${name}/agent.txt`.replace(/\\/g, '/');
  const f = Bun.file(overridePath);
  if (await f.exists()) {
    const text = await f.text();
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

  const tools = (entry?.tools ?? []) as string[];
  return { name, prompt, tools };
}

