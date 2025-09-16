import { intro, outro, select, multiselect, text, isCancel, cancel, log, confirm } from '@clack/prompts';
import { loadConfig } from '@/config/index.ts';

type ScaffoldOptions = { project?: string; local?: boolean };

export async function runScaffold(opts: ScaffoldOptions = {}) {
  const projectRoot = (opts.project ?? process.cwd()).replace(/\\/g, '/');
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const baseDir = opts.local ? `${projectRoot}/.agi` : `${home}/.agi`;
  const scopeLabel = opts.local ? 'local' : 'global';
  intro(`Scaffold (${scopeLabel})`);
  const kind = await select({
    message: 'What do you want to scaffold?',
    options: [
      { value: 'agent', label: 'Agent' },
      { value: 'tool', label: 'Tool' },
      { value: 'agents-config', label: 'Agents config (edit tools/prompt)' },
      { value: 'command', label: 'Command (manifest under .agi/commands/)' },
    ],
  });
  if (isCancel(kind)) return cancel('Cancelled');
  if (kind === 'agent') return await scaffoldAgent(projectRoot, baseDir);
  if (kind === 'tool') return await scaffoldTool(projectRoot); // tools remain project-local by default
  if (kind === 'agents-config') return await editAgentsConfig(projectRoot, baseDir, scopeLabel);
  if (kind === 'command') return await scaffoldCommand(projectRoot, baseDir, !!opts.local);
  outro('Done');
}

async function scaffoldAgent(projectRoot: string, baseDir: string): Promise<boolean> {
  const name = await text({
    message: 'Agent name (slug)',
    placeholder: 'e.g. git, reviewer, testgen',
    validate: (v) => (/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(String(v)) ? undefined : 'Use letters, numbers, - or _'),
  });
  if (isCancel(name)) { cancel('Cancelled'); return false; }
  const tools = await multiselect({
    message: 'Select tools to allow for this agent (finalize is always included)',
    // built-ins (excluding finalize) + discovered custom ids under .agi/tools/
    options: (await listAvailableTools(projectRoot, false)).map((t) => ({ value: t, label: t })),
  });
  if (isCancel(tools)) { cancel('Cancelled'); return false; }

  const wantPrompt = await confirm({ message: 'Create prompt file (.agi/agents/<name>.txt)?' });
  if (isCancel(wantPrompt)) { cancel('Cancelled'); return false; }
  const agentsPath = `${baseDir}/agents.json`;
  const current = await readJson(agentsPath).catch(() => ({} as Record<string, any>));
  let promptRel: string | undefined;
  if (wantPrompt) {
    const rel = `agents/${String(name)}.txt`;
    promptRel = baseDir.endsWith('/.agi') ? `.agi/${rel}` : rel; // if global, store just relative path preferred? we'll write absolute
    const promptAbs = `${baseDir}/${rel}`;
    await ensureDir(promptAbs.substring(0, promptAbs.lastIndexOf('/')));
    const template = defaultAgentPromptTemplate(String(name));
    await Bun.write(promptAbs, template);
  }
  // Always include finalize in tool allowlist
  const toolList = Array.from(new Set([...(tools as string[]), 'finalize']));
  current[String(name)] = {
    ...(current[String(name)] ?? {}),
    tools: toolList,
    ...(promptRel ? { prompt: promptRel } : {}),
  };
  await ensureDir(agentsPath.substring(0, agentsPath.lastIndexOf('/')));
  await Bun.write(agentsPath, JSON.stringify(current, null, 2));
  const scope = isGlobalBase(baseDir, projectRoot) ? 'global' : 'local';
  log.success(`Agent ${name} added to ${scope} agents.json`);
  if (promptRel) log.info(`Prompt: ${promptRel}`);
  outro('Done');
  return true;
}

async function scaffoldTool(projectRoot: string) {
  const id = await text({
    message: 'Tool id (slug)',
    placeholder: 'e.g. git_tag, docker_build',
    validate: (v) => (/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(String(v)) ? undefined : 'Use letters, numbers, - or _'),
  });
  if (isCancel(id)) return cancel('Cancelled');
  const desc = await text({ message: 'Description', placeholder: 'What does this tool do?' });
  if (isCancel(desc)) return cancel('Cancelled');
  const dir = `${projectRoot}/.agi/tools/${String(id)}`;
  await ensureDir(dir);
  const file = `${dir}/tool.ts`;
  const content = toolTemplate(String(desc));
  await Bun.write(file, content);
  log.success(`Tool created: .agi/tools/${String(id)}/tool.ts`);
  log.info('Tip: add this tool to an agent in .agi/agents.json under "tools".');
  outro('Done');
}

async function editAgentsConfig(projectRoot: string, baseDir: string, scopeLabel: string) {
  const agentsPath = `${baseDir}/agents.json`;
  log.message(`Editing ${scopeLabel} agents config`);
  const current = (await readJson(agentsPath).catch(() => ({}))) as Record<string, { tools?: string[]; prompt?: string }>;
  const names = Object.keys(current);
  let agentName = await select({
    message: 'Select agent to edit',
    options: [{ value: '__new__', label: '(new agent)' }, ...names.map((n) => ({ value: n, label: n }))],
  });
  if (isCancel(agentName)) { cancel('Cancelled'); return; }
  if (agentName === '__new__') {
    const nn = await text({ message: 'New agent name', validate: (v) => (/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(String(v)) ? undefined : 'Use letters, numbers, - or _') });
    if (isCancel(nn)) { cancel('Cancelled'); return; }
    agentName = String(nn);
  }
  const currentTools = current[String(agentName)]?.tools ?? [];
  const preselect = currentTools.filter((t) => t !== 'finalize');
  const toolsSel = await multiselect({
    message: `Tools for ${String(agentName)} (finalize is always included)`,
    options: (await listAvailableTools(projectRoot, false)).map((t) => ({ value: t, label: t })),
    initialValues: preselect,
  });
  if (isCancel(toolsSel)) { cancel('Cancelled'); return; }
  const relPrompt = `agents/${String(agentName)}.txt`;
  const pth = current[String(agentName)]?.prompt ?? (baseDir.endsWith('/.agi') ? `.agi/${relPrompt}` : relPrompt);
  const ensurePrompt = await confirm({ message: `Ensure prompt file exists at ${pth}?` });
  if (isCancel(ensurePrompt)) { cancel('Cancelled'); return; }
  if (ensurePrompt) {
    const abs = pth.startsWith('.agi/') ? `${projectRoot}/${pth}` : `${baseDir}/${relPrompt}`;
    await ensureDir(abs.substring(0, abs.lastIndexOf('/')));
    const f = Bun.file(abs);
    if (!(await f.exists())) await Bun.write(abs, defaultAgentPromptTemplate(String(agentName)));
  }
  const finalTools = Array.from(new Set([...(toolsSel as string[]), 'finalize']));
  current[String(agentName)] = { tools: finalTools, prompt: pth };
  await ensureDir(agentsPath.substring(0, agentsPath.lastIndexOf('/')));
  await Bun.write(agentsPath, JSON.stringify(current, null, 2));
  log.success(`Updated .agi/agents.json for ${String(agentName)}`);
  outro('Done');
}

async function scaffoldCommand(projectRoot: string, baseDir: string, localOnly: boolean) {
  const name = await text({ message: 'Command name', placeholder: 'e.g. review, release', validate: (v) => (/^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$/.test(String(v)) ? undefined : 'Use letters, numbers, - or _') });
  if (isCancel(name)) { cancel('Cancelled'); return; }
  // Pick agent interactively (existing or new)
  const agentPick = await select({
    message: 'Agent to use',
    options: [{ value: '__new__', label: '(new agent)' }, ... (await listAgents(projectRoot, localOnly)).map((a) => ({ value: a, label: a }))],
  });
  if (isCancel(agentPick)) { cancel('Cancelled'); return; }
  let agentName = String(agentPick);
  if (agentName === '__new__') {
    const created = await scaffoldAgent(projectRoot, baseDir);
    if (!created) return; // cancelled; stop flow
    // Ask again after creation to select the agent just added
    const sel = await select({ message: 'Select agent', options: (await listAgents(projectRoot, localOnly)).map((a) => ({ value: a, label: a })) });
    if (isCancel(sel)) { cancel('Cancelled'); return; }
    agentName = String(sel);
  }
  const description = await text({ message: 'Description (optional)', placeholder: 'What does this command do?' });
  if (isCancel(description)) { cancel('Cancelled'); return; }
  const template = await text({ message: 'Prompt template with {input} (enter to skip)', placeholder: 'e.g. Review changes. {input}' });
  if (isCancel(template)) { cancel('Cancelled'); return; }
  const needConfirm = await confirm({ message: 'Require confirmation step after first run?' });
  if (isCancel(needConfirm)) { cancel('Cancelled'); return; }
  let token: string | undefined;
  if (needConfirm) {
    const t = await text({ message: 'Confirmation token (default: [confirm:yes])', placeholder: '[confirm:yes]' });
    if (isCancel(t)) { cancel('Cancelled'); return; }
    token = String(t || '').trim() || '[confirm:yes]';
  }
  const interactive = await confirm({ message: 'Ask for {input} interactively when not provided?' });
  if (isCancel(interactive)) { cancel('Cancelled'); return; }

  const dir = `${baseDir}/commands`;
  await ensureDir(dir);
  const file = `${dir}/${String(name)}.json`;
  const manifest: any = {
    name: String(name),
    description: String(description || ''),
    agent: agentName,
    ...(String(template || '').trim() ? { promptTemplate: String(template).trim() } : {}),
    defaults: { agent: agentName },
    interactive: !!interactive,
  };
  if (needConfirm) manifest.confirm = { required: true, message: 'Proceed?', token };
  await Bun.write(file, JSON.stringify(manifest, null, 2));
  const scope = isGlobalBase(baseDir, projectRoot) ? 'global' : 'local';
  const display = scope === 'global' ? `~/.agi/commands/${String(name)}.json` : `.agi/commands/${String(name)}.json`;
  log.success(`Command created (${scope}): ${display}`);
  outro('Done');
}

async function listAvailableTools(projectRoot: string, includeFinalize: boolean): Promise<string[]> {
  const builtIns = ['fs_read', 'fs_write', 'fs_ls', 'fs_tree', 'git_status', 'git_diff', 'git_commit']
    .concat(includeFinalize ? ['finalize'] : []);
  const out = new Set(builtIns);
  try {
    const { promises: fs } = await import('node:fs');
    const dir = `${projectRoot}/.agi/tools`;
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    for (const name of entries) out.add(name);
  } catch {}
  return Array.from(out).sort();
}

async function listAgents(projectRoot: string, localOnly: boolean): Promise<string[]> {
  // Only show core built-ins that always exist + configured agents.
  // Do not include optional built-ins like 'git' unless explicitly configured.
  const defaults = ['general', 'build', 'plan'];
  try {
    if (localOnly) {
      const localAgents = (await Bun.file(`${projectRoot}/.agi/agents.json`).json().catch(() => ({}))) as Record<string, any>;
      const keys = Object.keys(localAgents);
      return Array.from(new Set([...defaults, ...keys]));
    } else {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      const globalAgents = (await Bun.file(`${home}/.agi/agents.json`).json().catch(() => ({}))) as Record<string, any>;
      const keys = Object.keys(globalAgents);
      return Array.from(new Set([...defaults, ...keys]));
    }
  } catch {
    return defaults;
  }
}

async function readJson(path: string) {
  const f = Bun.file(path);
  return await f.json();
}

async function ensureDir(dir: string) {
  try {
    const { promises: fs } = await import('node:fs');
    await fs.mkdir(dir, { recursive: true });
  } catch {}
}

function defaultAgentPromptTemplate(name: string): string {
  if (name.toLowerCase() === 'git') {
    return `You are a Git assistant. Review and commit guidance.\n\n- Use git_status and git_diff to inspect changes.\n- For reviews: summarize and suggest improvements.\n- For commits: draft a Conventional Commits message; require [commit:yes] before git_commit.\n- Stream your findings before finalize.`;
  }
  return `You are the ${name} agent. Describe your responsibilities here.\n\n- What tools you can use.\n- What the expected output looks like.\n- Always call finalize when done.`;
}

function toolTemplate(description: string): string {
  return `import { tool } from 'ai';
import { z } from 'zod';

export default tool({
  description: ${JSON.stringify(description)},
  inputSchema: z.object({
    query: z.string().describe('Input query'),
    flag: z.boolean().optional().default(false),
  }),
  async execute({ query, flag }: { query: string; flag?: boolean }) {
    // TODO: implement your tool logic
    return { ok: true, query, flag: !!flag };
  },
});
`;
}

function isGlobalBase(baseDir: string, projectRoot: string): boolean {
  const normalized = baseDir.replace(/\\/g, '/');
  const localBase = `${projectRoot.replace(/\\/g,'/')}/.agi`;
  return normalized !== localBase;
}
