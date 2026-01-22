import type { Command } from 'commander';
import { spawn } from 'node:child_process';

const INSTALL_URL = 'https://install.agi.nitish.sh';
const GITHUB_REPO = 'nitishxyz/agi';

async function fetchLatestVersion(): Promise<string | null> {
	try {
		const res = await fetch(
			`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
		);
		if (!res.ok) return null;
		const data = (await res.json()) as { tag_name?: string };
		const tag = data.tag_name ?? null;
		return tag?.replace(/^v/, '') ?? null;
	} catch {
		return null;
	}
}

function compareVersions(current: string, latest: string): number {
	const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
	const [c, l] = [parse(current), parse(latest)];
	for (let i = 0; i < Math.max(c.length, l.length); i++) {
		const diff = (l[i] ?? 0) - (c[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

async function runUpgrade(): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(`curl -fsSL ${INSTALL_URL} | sh`, [], {
			stdio: 'inherit',
			shell: true,
		});
		child.on('close', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Upgrade failed with code ${code}`));
		});
		child.on('error', reject);
	});
}

export function registerUpgradeCommand(program: Command, version: string) {
	program
		.command('upgrade')
		.description('Check for updates and upgrade agi')
		.option('-c, --check', 'Only check for updates, do not install')
		.action(async (opts) => {
			console.log(`Current version: ${version}`);

			const latest = await fetchLatestVersion();
			if (!latest) {
				console.log('Could not fetch latest version');
				process.exit(1);
			}

			console.log(`Latest version:  ${latest}`);

			const cmp = compareVersions(version, latest);
			if (cmp <= 0) {
				console.log('\n✓ You are on the latest version');
				return;
			}

			console.log(`\nUpdate available: ${version} → ${latest}`);

			if (opts.check) {
				console.log(`\nRun 'agi upgrade' to install`);
				return;
			}

			console.log('\nUpgrading...\n');
			await runUpgrade();
			console.log('\n✓ Upgrade complete');
		});
}
