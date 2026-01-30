import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { homedir } from 'node:os';

const AGI_BIN_DIR_NAME = 'bin';

let cachedBinDir: string | null = null;
const resolvedPaths = new Map<string, string>();
let cachedLoginPath: string | null = null;

function getConfigHome(): string {
	const cfgHome = process.env.XDG_CONFIG_HOME;
	if (cfgHome?.trim()) return cfgHome.replace(/\\/g, '/');
	const home = process.env.HOME || process.env.USERPROFILE || '';
	return join(home, '.config');
}

export function getAgiBinDir(): string {
	if (cachedBinDir) return cachedBinDir;
	cachedBinDir = join(getConfigHome(), 'agi', AGI_BIN_DIR_NAME);
	return cachedBinDir;
}

function getPlatformKey(): string {
	const platform = process.platform;
	const arch = process.arch;
	const os =
		platform === 'darwin'
			? 'darwin'
			: platform === 'win32'
				? 'windows'
				: 'linux';
	const cpu = arch === 'arm64' ? 'arm64' : 'x64';
	return `${os}-${cpu}`;
}

function getBinaryFileName(name: string): string {
	if (process.platform === 'win32') return `${name}.exe`;
	return name;
}

async function ensureDir(dir: string): Promise<void> {
	await fs.mkdir(dir, { recursive: true });
}

async function fileExists(p: string): Promise<boolean> {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

async function isExecutable(p: string): Promise<boolean> {
	try {
		await fs.access(p, 0o1);
		return true;
	} catch {
		return false;
	}
}

async function makeExecutable(p: string): Promise<void> {
	if (process.platform === 'win32') return;
	try {
		await fs.chmod(p, 0o755);
	} catch {}
}

async function whichBinary(name: string): Promise<string | null> {
	const cmd = process.platform === 'win32' ? 'where' : 'which';
	return new Promise((resolve) => {
		const proc = spawn(cmd, [name], { stdio: ['ignore', 'pipe', 'ignore'] });
		let stdout = '';
		proc.stdout.on('data', (d) => {
			stdout += d.toString();
		});
		proc.on('close', (code) => {
			if (code === 0 && stdout.trim()) resolve(stdout.trim().split('\n')[0]);
			else resolve(null);
		});
		proc.on('error', () => resolve(null));
	});
}

function getVendorSearchPaths(binaryName: string): string[] {
	const platformKey = getPlatformKey();
	const paths: string[] = [];

	const tauriResource = process.env.TAURI_RESOURCE_DIR;
	if (tauriResource) {
		paths.push(join(tauriResource, 'vendor', 'bin', platformKey, binaryName));
		paths.push(join(tauriResource, 'vendor', 'bin', binaryName));
	}

	try {
		const exePath = process.execPath;
		if (exePath) {
			const exeDir = join(exePath, '..');
			paths.push(join(exeDir, 'vendor', 'bin', platformKey, binaryName));
			paths.push(
				join(
					exeDir,
					'..',
					'Resources',
					'vendor',
					'bin',
					platformKey,
					binaryName,
				),
			);
		}
	} catch {}

	if (process.env.CARGO_MANIFEST_DIR) {
		paths.push(
			join(
				process.env.CARGO_MANIFEST_DIR,
				'resources',
				'vendor',
				'bin',
				platformKey,
				binaryName,
			),
		);
	}

	const cwd = process.cwd();
	paths.push(join(cwd, 'vendor', 'bin', platformKey, binaryName));

	return paths;
}

async function extractFromVendor(name: string): Promise<string | null> {
	const binaryName = getBinaryFileName(name);
	const binDir = getAgiBinDir();
	const targetPath = join(binDir, binaryName);

	if ((await fileExists(targetPath)) && (await isExecutable(targetPath))) {
		return targetPath;
	}

	const searchPaths = getVendorSearchPaths(binaryName);

	for (const src of searchPaths) {
		if (await fileExists(src)) {
			await ensureDir(binDir);
			await fs.copyFile(src, targetPath);
			await makeExecutable(targetPath);
			return targetPath;
		}
	}

	return null;
}

export async function resolveBinary(name: string): Promise<string> {
	const cached = resolvedPaths.get(name);
	if (cached) return cached;

	const binaryName = getBinaryFileName(name);
	const binDir = getAgiBinDir();
	const installedPath = join(binDir, binaryName);
	if (
		(await fileExists(installedPath)) &&
		(await isExecutable(installedPath))
	) {
		resolvedPaths.set(name, installedPath);
		return installedPath;
	}

	const vendorPath = await extractFromVendor(name);
	if (vendorPath) {
		resolvedPaths.set(name, vendorPath);
		return vendorPath;
	}

	const systemPath = await whichBinary(binaryName);
	if (systemPath) {
		resolvedPaths.set(name, systemPath);
		return systemPath;
	}

	return binaryName;
}

export function clearBinaryCache(): void {
	resolvedPaths.clear();
}

function getLoginShellPath(): string | null {
	if (cachedLoginPath !== null) return cachedLoginPath;

	if (process.platform === 'win32') {
		cachedLoginPath = process.env.PATH || '';
		return cachedLoginPath;
	}

	const home = process.env.HOME || homedir();
	const shellCandidates = [
		process.env.SHELL,
		'/bin/zsh',
		'/bin/bash',
		'/bin/sh',
	].filter(Boolean) as string[];

	for (const shell of shellCandidates) {
		try {
			const result = execSync(`${shell} -ilc 'echo "___PATH___:$PATH"'`, {
				timeout: 5000,
				stdio: ['ignore', 'pipe', 'ignore'],
				env: { HOME: home, USER: process.env.USER || '', SHELL: shell },
			});
			const output = result.toString();
			const match = output.match(/___PATH___:(.*)/);
			if (match?.[1]?.trim()) {
				cachedLoginPath = match[1].trim();
				return cachedLoginPath;
			}
		} catch {}
	}

	cachedLoginPath = null;
	return null;
}

export function getAugmentedPath(): string {
	const sep = process.platform === 'win32' ? ';' : ':';
	const binDir = getAgiBinDir();
	const current = process.env.PATH || '';
	const loginPath = getLoginShellPath();

	const seen = new Set<string>();
	const parts: string[] = [];

	for (const p of [
		binDir,
		...(loginPath ? loginPath.split(sep) : []),
		...current.split(sep),
	]) {
		if (p && !seen.has(p)) {
			seen.add(p);
			parts.push(p);
		}
	}

	return parts.join(sep);
}
