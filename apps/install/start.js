#!/usr/bin/env node

import {
	existsSync,
	createWriteStream,
	chmodSync,
	mkdirSync,
	statSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { get } from 'https';
import { homedir, platform, arch } from 'os';
import { spawnSync, spawn } from 'child_process';

const REPO = 'nitishxyz/agi';
const BIN_NAME = 'agi';

function isInWorkspace() {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const workspaceRoot = resolve(__dirname, '../../');
	return (
		existsSync(resolve(workspaceRoot, 'apps')) &&
		existsSync(resolve(workspaceRoot, 'packages'))
	);
}

function findBinaryInPath() {
	const pathDirs = (process.env.PATH || '').split(':');
	const ext = platform() === 'win32' ? '.exe' : '';
	const currentScript = fileURLToPath(import.meta.url);

	for (const dir of pathDirs) {
		const binPath = resolve(dir, `${BIN_NAME}${ext}`);
		if (existsSync(binPath)) {
			try {
				const stat = statSync(binPath);
				if (stat.isFile() && binPath !== currentScript) {
					const result = spawnSync('file', [binPath], { encoding: 'utf8' });
					if (!result.stdout.includes('script text')) {
						return binPath;
					}
				}
			} catch (err) {
				continue;
			}
		}
	}
	return null;
}

function getPlatformInfo() {
	const platformMap = {
		darwin: 'darwin',
		linux: 'linux',
		win32: 'windows',
	};

	const archMap = {
		x64: 'x64',
		arm64: 'arm64',
	};

	const os = platformMap[platform()];
	const architecture = archMap[arch()];
	const ext = platform() === 'win32' ? '.exe' : '';

	if (!os || !architecture) {
		throw new Error(`Unsupported platform: ${platform()}-${arch()}`);
	}

	return { os, arch: architecture, ext };
}

function downloadWithProgress(url, dest) {
	return new Promise((resolve, reject) => {
		const file = createWriteStream(dest);
		let totalBytes = 0;
		let downloadedBytes = 0;

		function handleRedirect(response) {
			if (
				response.statusCode >= 300 &&
				response.statusCode < 400 &&
				response.headers.location
			) {
				get(response.headers.location, handleRedirect);
			} else if (response.statusCode === 200) {
				totalBytes = Number.parseInt(
					response.headers['content-length'] || '0',
					10,
				);

				response.on('data', (chunk) => {
					downloadedBytes += chunk.length;
					if (totalBytes > 0) {
						const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
						const downloadedMB = (downloadedBytes / 1024 / 1024).toFixed(1);
						const totalMB = (totalBytes / 1024 / 1024).toFixed(1);
						process.stdout.write(
							`\rDownloading: ${percent}% (${downloadedMB}MB / ${totalMB}MB)`,
						);
					}
				});

				response.pipe(file);
				file.on('finish', () => {
					file.close();
					process.stdout.write('\n');
					resolve();
				});
			} else {
				reject(new Error(`Download failed: ${response.statusCode}`));
			}
		}

		get(url, handleRedirect).on('error', (err) => {
			file.close();
			reject(err);
		});
	});
}

async function install() {
	try {
		const { os, arch: architecture, ext } = getPlatformInfo();
		const asset = `${BIN_NAME}-${os}-${architecture}${ext}`;
		const url = `https://github.com/${REPO}/releases/latest/download/${asset}`;

		console.log(`Installing ${BIN_NAME} (${os}/${architecture})...`);

		const userBin = resolve(homedir(), '.local', 'bin');
		mkdirSync(userBin, { recursive: true });
		const binPath = resolve(userBin, `${BIN_NAME}${ext}`);

		await downloadWithProgress(url, binPath);

		chmodSync(binPath, 0o755);

		const result = spawnSync(binPath, ['--version'], { encoding: 'utf8' });
		if (result.status === 0) {
			console.log(`\n✓ ${BIN_NAME} installed successfully!`);
			console.log(`Version: ${result.stdout.trim()}`);
			console.log(`Location: ${binPath}`);

			const pathDirs = (process.env.PATH || '').split(':');
			if (!pathDirs.includes(userBin)) {
				console.log(`\n⚠️  Add ${userBin} to your PATH:`);
				console.log(
					`   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc`,
				);
				console.log(
					`   Or for zsh: echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc`,
				);
			}
		} else {
			console.log(`\n✓ Installed to ${binPath}`);
		}

		console.log(`\nRun: ${BIN_NAME} --help`);
		return binPath;
	} catch (error) {
		console.error('Failed to install agi CLI:', error.message);
		console.error('\nPlease try installing manually:');
		console.error('  curl -fsSL https://install.agi.nitish.sh | sh');
		process.exit(1);
	}
}

async function main() {
	if (isInWorkspace()) {
		console.log('Detected workspace environment, skipping install script.');
		return;
	}

	const binaryPath = findBinaryInPath();

	if (binaryPath) {
		const child = spawn(binaryPath, process.argv.slice(2), {
			stdio: 'inherit',
		});

		child.on('exit', (code) => {
			process.exit(code || 0);
		});
	} else {
		const installedPath = await install();

		if (process.argv.length > 2) {
			const child = spawn(installedPath, process.argv.slice(2), {
				stdio: 'inherit',
			});

			child.on('exit', (code) => {
				process.exit(code || 0);
			});
		}
	}
}

main();
