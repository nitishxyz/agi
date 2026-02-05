import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { getAgiBinDir } from '../core/src/tools/bin-manager.ts';

const BINARY_NAME = 'tunnel';
const CLOUDFLARED_VERSION = '2024.12.2';

interface PlatformInfo {
	os: 'darwin' | 'linux' | 'windows';
	arch: 'amd64' | 'arm64';
	ext: string;
}

function getPlatformInfo(): PlatformInfo {
	const platform = process.platform;
	const arch = process.arch;

	const os =
		platform === 'darwin'
			? 'darwin'
			: platform === 'win32'
				? 'windows'
				: 'linux';

	const cpu = arch === 'arm64' ? 'arm64' : 'amd64';
	const ext = platform === 'win32' ? '.exe' : '';

	return { os, arch: cpu, ext };
}

function getDownloadUrl(version: string, info: PlatformInfo): string {
	const base = `https://github.com/cloudflare/cloudflared/releases/download/${version}`;

	if (info.os === 'darwin') {
		return `${base}/cloudflared-darwin-${info.arch}.tgz`;
	}
	if (info.os === 'windows') {
		return `${base}/cloudflared-windows-${info.arch}.exe`;
	}
	return `${base}/cloudflared-linux-${info.arch}`;
}

async function fileExists(p: string): Promise<boolean> {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

async function ensureDir(dir: string): Promise<void> {
	await fs.mkdir(dir, { recursive: true });
}

async function makeExecutable(p: string): Promise<void> {
	if (process.platform === 'win32') return;
	try {
		await fs.chmod(p, 0o755);
	} catch {}
}

async function extractTarGz(tgzPath: string, destDir: string): Promise<string> {
	const { spawn } = await import('node:child_process');

	return new Promise((resolve, reject) => {
		const proc = spawn('tar', ['-xzf', tgzPath, '-C', destDir], {
			stdio: ['ignore', 'pipe', 'pipe'],
		});

		proc.on('close', (code) => {
			if (code === 0) {
				resolve(join(destDir, 'cloudflared'));
			} else {
				reject(new Error(`tar extraction failed with code ${code}`));
			}
		});

		proc.on('error', reject);
	});
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function downloadFile(
	url: string,
	dest: string,
	onProgress?: (message: string) => void,
): Promise<void> {
	const response = await fetch(url, { redirect: 'follow' });

	if (!response.ok) {
		throw new Error(`Download failed: ${response.status} ${response.statusText}`);
	}

	if (!response.body) {
		throw new Error('No response body');
	}

	await ensureDir(join(dest, '..'));

	const contentLength = response.headers.get('content-length');
	const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

	const fileStream = createWriteStream(dest);
	const reader = response.body.getReader();

	let downloadedBytes = 0;
	let lastProgressUpdate = 0;

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			fileStream.write(value);
			downloadedBytes += value.length;

			if (onProgress && totalBytes > 0) {
				const now = Date.now();
				if (now - lastProgressUpdate > 200) {
					const percent = Math.round((downloadedBytes / totalBytes) * 100);
					onProgress(`Downloading... ${formatBytes(downloadedBytes)} / ${formatBytes(totalBytes)} (${percent}%)`);
					lastProgressUpdate = now;
				}
			}
		}
		fileStream.end();

		await new Promise<void>((resolve, reject) => {
			fileStream.on('finish', resolve);
			fileStream.on('error', reject);
		});
	} finally {
		reader.releaseLock();
	}
}

export function getTunnelBinaryPath(): string {
	const binDir = getAgiBinDir();
	const ext = process.platform === 'win32' ? '.exe' : '';
	return join(binDir, `${BINARY_NAME}${ext}`);
}

export async function isTunnelBinaryInstalled(): Promise<boolean> {
	const binPath = getTunnelBinaryPath();
	return fileExists(binPath);
}

export async function downloadTunnelBinary(
	onProgress?: (message: string) => void,
): Promise<string> {
	const binPath = getTunnelBinaryPath();

	if (await fileExists(binPath)) {
		return binPath;
	}

	const info = getPlatformInfo();
	const url = getDownloadUrl(CLOUDFLARED_VERSION, info);
	const binDir = getAgiBinDir();

	await ensureDir(binDir);

	onProgress?.('Downloading tunnel binary (one-time setup)...');

	if (info.os === 'darwin') {
		const tgzPath = join(binDir, 'cloudflared.tgz');
		await downloadFile(url, tgzPath, onProgress);

		onProgress?.('Extracting...');
		const extractedPath = await extractTarGz(tgzPath, binDir);

		await fs.rename(extractedPath, binPath);
		await fs.unlink(tgzPath);
	} else {
		await downloadFile(url, binPath, onProgress);
	}

	await makeExecutable(binPath);
	onProgress?.('Tunnel binary ready.');

	return binPath;
}

export async function ensureTunnelBinary(
	onProgress?: (message: string) => void,
): Promise<string> {
	const binPath = getTunnelBinaryPath();

	if (await fileExists(binPath)) {
		return binPath;
	}

	return downloadTunnelBinary(onProgress);
}

export async function removeTunnelBinary(): Promise<void> {
	const binPath = getTunnelBinaryPath();
	if (await fileExists(binPath)) {
		await fs.unlink(binPath);
	}
}
