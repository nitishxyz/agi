import { createApp } from '@/server/index.ts';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { runAsk } from '@/cli/ask.ts';
// import { runSetup } from '@/cli/setup.ts';
import { runSessions } from '@/cli/sessions.ts';
// Ensure embedded assets are retained in compile builds
import '@/runtime/assets.ts';
import { intro, outro, text, isCancel, cancel } from '@clack/prompts';
import { runAuth } from '@/cli/auth.ts';
import { loadConfig as loadCfg } from '@/config/index.ts';
import { isProviderAuthorized } from '@/providers/authorization.ts';
import { runModels } from '@/cli/models.ts';
import { runAuth } from '@/cli/auth.ts';

const argv = process.argv.slice(2);
const cmd = argv[0];

async function main() {
  // Global help (no auth required)
  const wantsHelp = argv.includes('--help') || argv.includes('-h');
  if (wantsHelp) {
    printHelp();
    return;
  }
  if (cmd === 'serve') {
		// Ensure DB exists and migrations are applied before serving
		const projectRoot = process.cwd();
		if (!(await ensureSomeAuth(projectRoot))) return;
		const cfg = await loadConfig(projectRoot);
		await getDb(cfg.projectRoot);

		const app = createApp();
		const portEnv = process.env.PORT ? Number(process.env.PORT) : 0;
		const portFlagIndex = argv.indexOf('--port');
		const port =
			portFlagIndex >= 0 ? Number(argv[portFlagIndex + 1]) : portEnv || 0;
    const server = Bun.serve({ port, fetch: app.fetch, idleTimeout: 240 });
    console.log(`agi server listening on http://localhost:${server.port}`);
    return;
  }

  if (cmd === 'sessions') {
    const projectIdx = argv.indexOf('--project');
    const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();
    if (!(await ensureSomeAuth(projectRoot))) return;
    const json = argv.includes('--json');
    const listFlag = argv.includes('--list');
    // Default behavior: interactive pick unless --list or --json is provided
    const pick = !listFlag && !json ? true : argv.includes('--pick');
    const limitIdx = argv.indexOf('--limit');
    const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : undefined;
    await runSessions({ project: projectRoot, json, pick, limit });
    return;
  }

  if (cmd === 'models' || cmd === 'switch') {
    const projectIdx = argv.indexOf('--project');
    const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();
    if (!(await ensureSomeAuth(projectRoot))) return;
    await runModels({ project: projectRoot });
    return;
  }

  if (cmd === 'auth') {
    await runAuth(argv.slice(1));
    return;
  }

  if (cmd === 'setup') {
    // Setup is now just auth login
    await runAuth(['login']);
    return;
  }

  // One-shot: agi "<prompt>" [--agent] [--provider] [--model] [--project]
  if (cmd && !cmd.startsWith('-')) {
    const prompt = cmd;
    const agentIdx = argv.indexOf('--agent');
    const providerIdx = argv.indexOf('--provider');
    const modelIdx = argv.indexOf('--model');
    const projectIdx = argv.indexOf('--project');
    const lastFlag = argv.includes('--last');
    const sessionIdx = argv.indexOf('--session');
    const agent = agentIdx >= 0 ? argv[agentIdx + 1] : undefined;
    const provider = providerIdx >= 0 ? (argv[providerIdx + 1] as any) : undefined;
    const model = modelIdx >= 0 ? argv[modelIdx + 1] : undefined;
    const project = projectIdx >= 0 ? argv[projectIdx + 1] : undefined;
    const sessionId = sessionIdx >= 0 ? argv[sessionIdx + 1] : undefined;
    if (!(await ensureSomeAuth(project ?? process.cwd()))) return;
    await runAsk(prompt, { agent, provider, model, project, last: lastFlag, sessionId });
    return;
  }

  // No non-flag command provided: context-aware interactive mode
  // Respect flags like --project, --last, --session (and optionally agent/provider/model)
  const projectIdx = argv.indexOf('--project');
  const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();
  if (!(await ensureSomeAuth(projectRoot))) return;
  const cfg = await loadConfig(projectRoot);
  await getDb(cfg.projectRoot);

  // Prompt for input if none provided
  intro('agi');
  const input = await text({ message: 'What would you like to ask?' });
  if (isCancel(input)) return cancel('Cancelled');
  const prompt = String(input ?? '').trim();
  if (!prompt) {
    outro('No input provided. Exiting.');
    return;
  }
  const agentIdx = argv.indexOf('--agent');
  const providerIdx = argv.indexOf('--provider');
  const modelIdx = argv.indexOf('--model');
  const lastFlag = argv.includes('--last');
  const sessionIdx = argv.indexOf('--session');
  const agent = agentIdx >= 0 ? argv[agentIdx + 1] : undefined;
  const provider = providerIdx >= 0 ? (argv[providerIdx + 1] as any) : undefined;
  const model = modelIdx >= 0 ? argv[modelIdx + 1] : undefined;
  const sessionId = sessionIdx >= 0 ? argv[sessionIdx + 1] : undefined;
  await runAsk(prompt, { project: projectRoot, agent, provider, model, last: lastFlag, sessionId });
}

main();

function printHelp() {
  const lines = [
    'Usage: agi [command] [options] [prompt]',
    '',
    'Commands:',
    '  serve                    Start the HTTP server',
    '  sessions [--list|--json] Manage or pick sessions (default: pick)',
    '  auth <login|list|logout> Manage provider credentials',
    '  setup                   Alias for `auth login`',
    '  models|switch           Pick default provider/model (interactive)',
    '  chat [--last|--session] Start an interactive chat (if enabled)',
    '',
    'One-shot ask:',
    '  agi "<prompt>" [--agent <name>] [--provider <p>] [--model <m>] [--project <path>] [--last|--session <id>]',
    '',
    'Common options:',
    '  --project <path>         Use project at <path> (default: cwd)',
    '  --last                   Send to most-recent session',
    '  --session <id>           Send to a specific session',
    '  --json | --json-stream   Machine-readable outputs',
  ];
  Bun.write(Bun.stdout, lines.join('\n') + '\n');
}

async function ensureSomeAuth(projectRoot: string): Promise<boolean> {
  const cfg = await loadCfg(projectRoot);
  const any = await Promise.all([
    isProviderAuthorized(cfg, 'openai'),
    isProviderAuthorized(cfg, 'anthropic'),
    isProviderAuthorized(cfg, 'google'),
  ]).then((arr) => arr.some(Boolean));
  if (!any) {
    await runAuth(['login']);
    const cfg2 = await loadCfg(projectRoot);
    const any2 = await Promise.all([
      isProviderAuthorized(cfg2, 'openai'),
      isProviderAuthorized(cfg2, 'anthropic'),
      isProviderAuthorized(cfg2, 'google'),
    ]).then((arr) => arr.some(Boolean));
    return any2;
  }
  return true;
}
