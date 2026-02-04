import type { Command } from 'commander';
import { spawn } from 'node:child_process';

const INSTALL_URL = 'https://install.ottocode.io';
const GITHUB_REPO = 'nitishxyz/otto';

async function fetchLatestVersion(): Promise<string | null> {
	try {
		// Fetch releases and find the highest version with CLI assets
		const res = await fetch(
			`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`,
		);
		if (!res.ok) return null;
		const releases = (await res.json()) as {
			tag_name?: string;
			assets?: { name: string }[];
			draft?: boolean;
			prerelease?: boolean;
		}[];

		// Filter to CLI releases only (have otto-* assets, not desktop)
		const cliReleases = releases.filter((r) => {
			if (r.draft || r.prerelease) return false;
			if (!r.tag_name?.match(/^v\d/)) return false;
			return r.assets?.some((a) => a.name.startsWith('otto-'));
		});

		if (cliReleases.length === 0) return null;

		// Sort by semantic version (highest first)
		cliReleases.sort((a, b) => {
			const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
			// Tag name is guaranteed to exist from filter above
			const va = parse(a.tag_name ?? '0.0.0');
			const vb = parse(b.tag_name ?? '0.0.0');
			for (let i = 0; i < Math.max(va.length, vb.length); i++) {
				const diff = (vb[i] ?? 0) - (va[i] ?? 0);
				if (diff !== 0) return diff;
			}
			return 0;
		});

		return cliReleases[0]?.tag_name?.replace(/^v/, '') ?? null;
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

async function runUpgrade(version: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(`curl -fsSL ${INSTALL_URL} | sh`, [], {
			stdio: 'inherit',
			shell: true,
			env: { ...process.env, OTTO_VERSION: `v${version}` },
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
		.description('Check for updates and upgrade otto')
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
				console.log(`\nRun 'otto upgrade' to install`);
				return;
			}

			console.log('\nUpgrading...\n');
			await runUpgrade(latest);
			console.log('\n✓ Upgrade complete');
		});
}
