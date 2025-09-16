import { read as readMerged, isAuthorized } from '@/config/manager.ts';
import { box, table, colors } from '@/cli/ui.ts';

export async function runDoctor(opts: { project?: string } = {}) {
  const projectRoot = opts.project ?? process.cwd();
  const { cfg, auth } = await readMerged(projectRoot);
  // Credentials source per provider
  const providers: Array<'openai'|'anthropic'|'google'> = ['openai','anthropic','google'];
  const rows: string[][] = [];
  for (const p of providers) {
    const source = credSource(p, cfg, auth);
    const ok = await isAuthorized(p, projectRoot);
    rows.push([p, ok ? colors.green('ok') : colors.red('missing'), source]);
  }
  box('Credentials', []);
  table(['Provider', 'Status', 'Source'], rows);

  const def = cfg.defaults;
  const defAuth = await isAuthorized(def.provider as any, projectRoot);
  const defStatus = defAuth ? colors.green('ok') : colors.red('unauthorized');
  box('Defaults', [
    `agent: ${def.agent}`,
    `provider: ${def.provider} (${defStatus})`,
    `model: ${def.model}`,
  ]);

  // Agent finalize check
  const agentIssues: string[] = [];
  try {
    const agentsJson = (await Bun.file(`${projectRoot}/.agi/agents.json`).json().catch(() => ({}))) as Record<string, { tools?: string[] }>;
    for (const [name, val] of Object.entries(agentsJson)) {
      if (!val?.tools || !val.tools.includes('finalize')) agentIssues.push(`${name}: missing finalize in tools`);
    }
  } catch {}
  if (agentIssues.length) box('Agents', [colors.yellow('Issues found:'), ...agentIssues]);
  else box('Agents', [colors.green('All project agents include finalize or rely on defaults')]);

  // Suggestions
  const sugg: string[] = [];
  if (!defAuth) sugg.push(`Run: agi auth login (${def.provider}) or switch defaults: agi models`);
  if (agentIssues.length) sugg.push('Edit .agi/agents.json and ensure each agent tools includes "finalize".');
  if (sugg.length) box('Suggestions', sugg); else box('Suggestions', [colors.green('No obvious issues found')]);
}

function credSource(p: 'openai'|'anthropic'|'google', cfg: any, auth: any): string {
  if (p === 'openai' && process.env.OPENAI_API_KEY) return 'env';
  if (p === 'anthropic' && process.env.ANTHROPIC_API_KEY) return 'env';
  if (p === 'google' && process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 'env';
  // local/global detection by existence path is coarse; we merged, so just indicate auth.json
  if (auth?.[p]?.key) return 'auth.json (local/global)';
  if (cfg.providers?.[p]?.apiKey) return 'config (legacy)';
  return '-';
}

