import { Glob } from 'bun';
import { intro, outro, text, isCancel, cancel, log, confirm } from '@clack/prompts';
import { loadConfig } from '@/config/index.ts';
import { runAsk, getOrStartServerUrl, stopEphemeralServer } from '@/cli/ask.ts';

export type CommandManifest = {
  name: string;
  description?: string;
  agent: string;
  prompt?: string; // inline prompt override
  promptPath?: string; // relative path to prompt text
  promptTemplate?: string; // e.g., "Draft a message: {input}"
  defaults?: { provider?: 'openai' | 'anthropic' | 'google'; model?: string; agent?: string };
  confirm?: { required?: boolean; message?: string; token?: string };
  interactive?: boolean; // if true and no input, prompt user for {input}
};

export async function discoverCommands(projectRoot: string): Promise<Record<string, CommandManifest>> {
  const commands: Record<string, CommandManifest> = {};
  const home = process.env.HOME || process.env.USERPROFILE || '';

  // Helper to merge a manifest map into commands if valid
  function mergeMap(map: Record<string, CommandManifest> | undefined) {
    if (!map) return;
    for (const [k, v] of Object.entries(map)) if (v && (v.name || k) && v.agent) commands[v.name || k] = { name: v.name || k, ...v };
  }
  // Helper to read a single file
  async function readJson(path: string) {
    try { const f = Bun.file(path); if (await f.exists()) return JSON.parse(await f.text()); } catch {}
    return undefined;
  }
  // 1) Global aggregate
  mergeMap(await readJson(`${home}/.agi/commands.json`));
  // 2) Global per-file commands
  await scanDirInto(`${home}/.agi/commands`, commands);
  // 3) Project aggregate overrides global
  mergeMap(await readJson(`${projectRoot}/.agi/commands.json`));
  // 4) Project per-file overrides global
  await scanDirInto(`${projectRoot}/.agi/commands`, commands);
  return commands;
}

async function scanDirInto(dir: string, commands: Record<string, CommandManifest>) {
  try {
    const { promises: fs } = await import('node:fs');
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    for (const file of entries) {
      if (!file.endsWith('.json')) continue;
      try {
        const name = file.replace(/\.json$/i, '');
        const f = Bun.file(`${dir}/${file}`);
        if (!(await f.exists())) continue;
        const manifest = JSON.parse(await f.text()) as CommandManifest;
        if (manifest && (manifest.name || name) && manifest.agent) {
          commands[manifest.name || name] = { name: manifest.name || name, ...manifest };
        }
      } catch {}
    }
  } catch {}
}

export async function runDiscoveredCommand(name: string, argv: string[], projectRoot: string): Promise<boolean> {
  const cfg = await loadConfig(projectRoot);
  const cmds = await discoverCommands(projectRoot);
  const cmd = cmds[name];
  if (!cmd) return false;
  // Build input text from remaining args
  const inputTokens = argv.filter((a) => !a.startsWith('--'));
  let userInput = inputTokens.join(' ').trim();
  if (!userInput && cmd.interactive) {
    intro(cmd.name);
    const got = await text({ message: cmd.description ? `${cmd.description}\nInput:` : 'Input:' });
    if (isCancel(got)) return !!cancel('Cancelled');
    userInput = String(got ?? '').trim();
    outro('');
  }
  // Render final prompt for user message
  const rendered = cmd.promptTemplate
    ? cmd.promptTemplate.replace('{input}', userInput)
    : userInput || (cmd.prompt || '');

  // Choose defaults
  const agent = cmd.defaults?.agent || cmd.agent;
  const provider = cmd.defaults?.provider;
  const model = cmd.defaults?.model;

  // Keep one ephemeral server across both runs to avoid port=0 races
  const prevUrl = process.env.AGI_SERVER_URL;
  try {
    process.env.AGI_SERVER_URL = await getOrStartServerUrl();
    // First run: propose or perform
    await runAsk(rendered, { project: projectRoot, agent, provider, model });
    // Optional confirm: send follow-up to trigger action token
    if (cmd.confirm?.required) {
      const ok = await confirm({ message: cmd.confirm.message || 'Proceed?' });
      if (isCancel(ok) || !ok) return true;
      const token = cmd.confirm.token || '[confirm:yes]';
      await runAsk(token, { project: projectRoot, agent, provider, model, last: true });
    }
  } finally {
    if (prevUrl !== undefined) process.env.AGI_SERVER_URL = prevUrl; else delete (process.env as any).AGI_SERVER_URL;
    await stopEphemeralServer().catch(() => {});
  }
  return true;
}
