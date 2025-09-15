import { createApp } from '@/server/index.ts';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { runAsk } from '@/cli/ask.ts';
import { runSetup } from '@/cli/setup.ts';
import { runSessions } from '@/cli/sessions.ts';
// Ensure embedded assets are retained in compile builds
import '@/runtime/assets.ts';
import { intro, outro, text, isCancel, cancel } from '@clack/prompts';

const argv = process.argv.slice(2);
const cmd = argv[0];

async function main() {
  if (cmd === 'serve') {
		// Ensure DB exists and migrations are applied before serving
		const projectRoot = process.cwd();
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
    const json = argv.includes('--json');
    const listFlag = argv.includes('--list');
    // Default behavior: interactive pick unless --list or --json is provided
    const pick = !listFlag && !json ? true : argv.includes('--pick');
    const limitIdx = argv.indexOf('--limit');
    const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : undefined;
    await runSessions({ project: projectRoot, json, pick, limit });
    return;
  }

  if (cmd === 'setup') {
    const projectFlagIndex = argv.indexOf('--project');
    const projectRoot = projectFlagIndex >= 0 ? argv[projectFlagIndex + 1] : process.cwd();
    await runSetup(projectRoot);
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
    await runAsk(prompt, { agent, provider, model, project, last: lastFlag, sessionId });
    return;
  }

  // No non-flag command provided: context-aware interactive mode
  // Respect flags like --project, --last, --session (and optionally agent/provider/model)
  const projectIdx = argv.indexOf('--project');
  const projectRoot = projectIdx >= 0 ? argv[projectIdx + 1] : process.cwd();
  const cfg = await loadConfig(projectRoot);
  await getDb(cfg.projectRoot);

  // Decide whether to run setup wizard
  const hasProjectCfg = Boolean(cfg.paths.projectConfigPath);
  const hasGlobalCfg = Boolean(cfg.paths.globalConfigPath);
  const haveAnyApiKey = Boolean(
    cfg.providers.openai?.apiKey ||
    cfg.providers.anthropic?.apiKey ||
    cfg.providers.google?.apiKey ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  );

  if (!(hasProjectCfg || hasGlobalCfg) || !haveAnyApiKey) {
    await runSetup(projectRoot);
  }

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
