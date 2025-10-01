#!/usr/bin/env node

import { existsSync, createWriteStream, chmodSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { get } from 'https';
import { homedir, platform, arch } from 'os';
import { spawnSync } from 'child_process';

const REPO = 'nitishxyz/agi';
const BIN_NAME = 'agi';

// Skip if running in a workspace (local development)
function isInWorkspace() {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const workspaceRoot = resolve(__dirname, '../../');
	return (
		existsSync(resolve(workspaceRoot, 'apps')) &&
		existsSync(resolve(workspaceRoot, 'packages'))
	);
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

function download(url, dest) {
	return new Promise((resolve, reject) => {
		const file = createWriteStream(dest);

		function handleRedirect(response) {
			if (
				response.statusCode >= 300 &&
				response.statusCode < 400 &&
				response.headers.location
			) {
				get(response.headers.location, handleRedirect);
			} else if (response.statusCode === 200) {
				response.pipe(file);
				file.on('finish', () => {
					file.close();
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
	if (isInWorkspace()) {
		console.log('Detected workspace environment, skipping install script.');
		return;
	}

	try {
		const { os, arch: architecture, ext } = getPlatformInfo();
		const asset = `${BIN_NAME}-${os}-${architecture}${ext}`;
		const url = `https://github.com/${REPO}/releases/latest/download/${asset}`;

		console.log(`Installing ${BIN_NAME} (${os}/${architecture})...`);

		// Determine install directory
		const userBin = resolve(homedir(), '.local', 'bin');
		mkdirSync(userBin, { recursive: true });
		const binPath = resolve(userBin, `${BIN_NAME}${ext}`);

		// Download
		console.log(`Downloading from ${url}...`);
		await download(url, binPath);

		// Make executable
		chmodSync(binPath, 0o755);

		// Verify
		const result = spawnSync(binPath, ['--version'], { encoding: 'utf8' });
		if (result.status === 0) {
			console.log(`\n✓ ${BIN_NAME} installed successfully!`);
			console.log(`Version: ${result.stdout.trim()}`);
			console.log(`Location: ${binPath}`);

			// Check if in PATH
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
	} catch (error) {
		console.error('Failed to install agi CLI:', error.message);
		console.error('\nPlease try installing manually:');
		console.error('  curl -fsSL https://install.agi.nitish.sh | sh');
		process.exit(1);
	}
}

install();
