import { createApp } from '@/server/index.ts';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { runAsk } from '@/cli/ask.ts';
import { runSetup } from '@/cli/setup.ts';
// Ensure embedded assets are retained in compile builds
import '@/runtime/assets.ts';

const argv = process.argv.slice(2);
const cmd = argv[0];

async function main() {
  if (!cmd || cmd === 'serve') {
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
    const agent = agentIdx >= 0 ? argv[agentIdx + 1] : undefined;
    const provider = providerIdx >= 0 ? (argv[providerIdx + 1] as any) : undefined;
    const model = modelIdx >= 0 ? argv[modelIdx + 1] : undefined;
    const project = projectIdx >= 0 ? argv[projectIdx + 1] : undefined;
    await runAsk(prompt, { agent, provider, model, project });
    return;
  }
}

main();
