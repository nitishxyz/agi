import { Glob } from 'bun';
import { intro, outro, text, isCancel, cancel, log, confirm } from '@clack/prompts';
import { loadConfig } from '@/config/index.ts';
import { runAsk } from '@/cli/ask.ts';

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
  // Aggregate file: .agi/commands.json
  try {
    const agg = Bun.file(`${projectRoot}/.agi/commands.json`);
    if (await agg.exists()) {
      const obj = JSON.parse(await agg.text()) as Record<string, CommandManifest>;
      for (const [k, v] of Object.entries(obj)) if (v && v.agent) commands[k] = v;
    }
  } catch {}
  // Per-command files: .agi/commands/<name>.json
  try {
    const glob = new Glob('.agi/commands/*.json');
    for await (const rel of glob.scan({ cwd: projectRoot })) {
      try {
        const name = rel.split('/').pop()!.replace(/\.json$/i, '');
        const f = Bun.file(`${projectRoot}/${rel}`);
        const manifest = JSON.parse(await f.text()) as CommandManifest;
        if (manifest && (manifest.name || name) && manifest.agent) {
          commands[manifest.name || name] = { name: manifest.name || name, ...manifest };
        }
      } catch {}
    }
  } catch {}
  // Fallback: Node fs readdir in case Glob scan fails in some envs
  if (Object.keys(commands).length === 0) {
    try {
      const { promises: fs } = await import('node:fs');
      const dir = `${projectRoot}/.agi/commands`;
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
  return commands;
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

  // First run: propose or perform
  await runAsk(rendered, { project: projectRoot, agent, provider, model });

  // Optional confirm: send follow-up to trigger commit/action token
  if (cmd.confirm?.required) {
    const ok = await confirm({ message: cmd.confirm.message || 'Proceed?' });
    if (isCancel(ok) || !ok) return true;
    const token = cmd.confirm.token || '[confirm:yes]';
    await runAsk(token, { project: projectRoot, agent, provider, model, last: true });
  }
  return true;
}
