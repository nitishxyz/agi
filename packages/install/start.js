#!/usr/bin/env node

import {
	existsSync,
	createWriteStream,
	chmodSync,
	mkdirSync,
	statSync,
	readFileSync,
	appendFileSync,
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get } from 'node:https';
import { homedir, platform, arch } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';

const REPO = 'nitishxyz/otto';
const BIN_NAME = 'otto';

function isInWorkspace() {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const workspaceRoot = resolve(__dirname, '../../');
	return (
		existsSync(resolve(workspaceRoot, 'apps')) &&
		existsSync(resolve(workspaceRoot, 'packages'))
	);
}

function findBinaryInPath() {
	const sep = platform() === 'win32' ? ';' : ':';
	const pathDirs = (process.env.PATH || '').split(sep);
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
			} catch (_err) {}
		}
	}
	return null;
}

function getVersion(binaryPath) {
	try {
		const result = spawnSync(binaryPath, ['--version'], { encoding: 'utf8' });
		if (result.status === 0 && result.stdout) {
			// Extract version number from output (e.g., "otto 1.2.3" -> "1.2.3")
			const match = result.stdout.trim().match(/[\d.]+/);
			return match ? match[0] : null;
		}
	} catch (_err) {
		// If we can't get version, return null
	}
	return null;
}

function getLatestVersion() {
	const __dirname = dirname(fileURLToPath(import.meta.url));
	const packageJsonPath = resolve(__dirname, 'package.json');

	try {
		const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
		return Promise.resolve(packageJson.version);
	} catch (err) {
		return Promise.reject(
			new Error(`Could not read package.json version: ${err.message}`),
		);
	}
}

function compareVersions(v1, v2) {
	if (!v1 || !v2) return null;

	const parts1 = v1.split('.').map(Number);
	const parts2 = v2.split('.').map(Number);

	for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
		const part1 = parts1[i] || 0;
		const part2 = parts2[i] || 0;

		if (part1 > part2) return 1;
		if (part1 < part2) return -1;
	}

	return 0; // Equal
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

function updateShellProfile(userBin) {
	// Skip on Windows
	if (platform() === 'win32') return;

	const shell = process.env.SHELL || '';
	let configFile;
	let shellType;

	if (shell.includes('zsh')) {
		configFile = resolve(homedir(), '.zshrc');
		shellType = 'zsh';
	} else if (shell.includes('bash')) {
		configFile = resolve(homedir(), '.bashrc');
		shellType = 'bash';
	} else {
		configFile = resolve(homedir(), '.profile');
		shellType = 'shell';
	}

	const pathExport = 'export PATH="$HOME/.local/bin:$PATH"';

	try {
		let fileContent = '';
		if (existsSync(configFile)) {
			fileContent = readFileSync(configFile, 'utf8');
		}

		// Check if .local/bin is already in the config file
		if (fileContent.includes('.local/bin')) {
			console.log(`✓ PATH already configured in ${configFile}`);
			return;
		}

		// Add the PATH export
		appendFileSync(configFile, `\n${pathExport}\n`);
		console.log(`✓ Added ${userBin} to PATH in ${configFile}`);
		console.log(`✓ Restart your ${shellType} or run: source ${configFile}`);
	} catch (_error) {
		// Silently fail if we can't update the profile
		console.log(`⚠️  Could not automatically update ${configFile}`);
	}
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

			const pathSep = platform() === 'win32' ? ';' : ':';
			const pathDirs = (process.env.PATH || '').split(pathSep);
			if (!pathDirs.includes(userBin)) {
				updateShellProfile(userBin);
				console.log(`\n⚠️  Add ${userBin} to your PATH:`);
				console.log(
					`   echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc`,
				);
				console.log(
					`   Or for zsh: echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc`,
				);
			} else {
				console.log(`✓ ${userBin} already in PATH`);
			}
		} else {
			console.log(`\n✓ Installed to ${binPath}`);
		}

		console.log(`\nRun: ${BIN_NAME} --help`);
		return binPath;
	} catch (error) {
		console.error('Failed to install otto CLI:', error.message);
		console.error('\nPlease try installing manually:');
		console.error('  curl -fsSL https://install.ottocode.io | sh');
		process.exit(1);
	}
}

async function checkAndUpdateVersion(binaryPath) {
	try {
		const currentVersion = getVersion(binaryPath);

		if (!currentVersion) {
			console.log('⚠️  Could not determine current version');
			return { needsUpdate: false, binaryPath };
		}

		console.log(`Current version: ${currentVersion}`);
		console.log('Checking for updates...');

		const latestVersion = await getLatestVersion();
		console.log(`Latest version: ${latestVersion}`);

		const comparison = compareVersions(currentVersion, latestVersion);

		if (comparison < 0) {
			// Current version is older
			console.log(
				`\n🔄 New version available: ${currentVersion} → ${latestVersion}`,
			);
			console.log('Updating...\n');
			const newBinaryPath = await install();
			return { needsUpdate: true, binaryPath: newBinaryPath };
		} else if (comparison > 0) {
			// Current version is newer (dev version?)
			console.log(
				`✓ You have a newer version (${currentVersion}) than the latest release`,
			);
			return { needsUpdate: false, binaryPath };
		} else {
			// Versions match
			console.log('✓ You have the latest version');
			return { needsUpdate: false, binaryPath };
		}
	} catch (error) {
		console.log(`⚠️  Could not check for updates: ${error.message}`);
		return { needsUpdate: false, binaryPath };
	}
}

async function main() {
	if (isInWorkspace()) {
		console.log('Detected workspace environment, skipping install script.');
		return;
	}

	let binaryPath = findBinaryInPath();

	if (binaryPath) {
		// Binary exists, check version
		const { binaryPath: updatedPath } = await checkAndUpdateVersion(binaryPath);
		binaryPath = updatedPath;

		const child = spawn(binaryPath, process.argv.slice(2), {
			stdio: 'inherit',
		});

		child.on('exit', (code) => {
			process.exit(code || 0);
		});
	} else {
		// No binary found, install fresh
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
