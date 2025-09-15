import { createApp } from '@/server/index.ts';
import { loadConfig } from '@/config/index.ts';
import { getDb } from '@/db/index.ts';
import { runSetup } from '@/cli/setup.ts';

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
		const server = Bun.serve({ port, fetch: app.fetch });
		console.log(`agi server listening on http://localhost:${server.port}`);
    return;
  }

  if (cmd === 'setup') {
    const projectFlagIndex = argv.indexOf('--project');
    const projectRoot = projectFlagIndex >= 0 ? argv[projectFlagIndex + 1] : process.cwd();
    await runSetup(projectRoot);
    return;
  }

  // Placeholder: in future support one-shot prompt: agi "<prompt>"
  if (cmd && !cmd.startsWith('-')) {
    console.error('One-shot prompt not implemented yet. Use: agi serve');
    process.exit(1);
  }
}

main();
