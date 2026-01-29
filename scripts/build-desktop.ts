#!/usr/bin/env bun
/**
 * Build Desktop App
 *
 * Builds the CLI binary for the current platform and packages the Tauri desktop app.
 *
 * Usage:
 *   bun run scripts/build-desktop.ts [--dev] [--all-platforms]
 *
 * Options:
 *   --dev            Build in dev mode (skip production build)
 *   --all-platforms  Build CLI binaries for all platforms (requires cross-compile setup)
 */

import { $ } from 'bun';
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dir, '..');
const CLI_DIR = join(ROOT, 'apps/cli');
const DESKTOP_DIR = join(ROOT, 'apps/desktop');
const BINARIES_DIR = join(DESKTOP_DIR, 'src-tauri/resources/binaries');

const PLATFORMS = {
	'darwin-arm64': 'bun-darwin-arm64',
	'darwin-x64': 'bun-darwin-x64',
	'linux-x64': 'bun-linux-x64',
	'linux-arm64': 'bun-linux-arm64',
} as const;

function detectPlatform(): keyof typeof PLATFORMS {
	const os = process.platform;
	const arch = process.arch;

	if (os === 'darwin' && arch === 'arm64') return 'darwin-arm64';
	if (os === 'darwin' && arch === 'x64') return 'darwin-x64';
	if (os === 'linux' && arch === 'x64') return 'linux-x64';
	if (os === 'linux' && arch === 'arm64') return 'linux-arm64';

	throw new Error(`Unsupported platform: ${os}-${arch}`);
}

async function buildCliBinary(platform: keyof typeof PLATFORMS) {
	console.log(`\n📦 Building CLI binary for ${platform}...`);

	const target = PLATFORMS[platform];
	const outfile = join(CLI_DIR, 'dist', `agi-${platform}`);

	await $`cd ${CLI_DIR} && bun run prebuild`;
	await $`cd ${CLI_DIR} && bun build --compile --minify --target=${target} ./index.ts --outfile ${outfile}`;

	return outfile;
}

async function copyBinaryToDesktop(binaryPath: string, platform: string) {
	console.log(`\n📋 Copying binary to desktop resources...`);

	if (!existsSync(BINARIES_DIR)) {
		mkdirSync(BINARIES_DIR, { recursive: true });
	}

	const destPath = join(BINARIES_DIR, `agi-${platform}`);
	copyFileSync(binaryPath, destPath);

	// Make executable
	await $`chmod +x ${destPath}`;

	console.log(`   ✅ Copied to ${destPath}`);
}

async function buildDesktopApp(devMode: boolean) {
	console.log(`\n🖥️  Building Tauri desktop app...`);

	process.chdir(DESKTOP_DIR);

	if (devMode) {
		await $`bun run tauri dev`;
	} else {
		await $`bun run tauri build`;
	}
}

async function main() {
	const args = process.argv.slice(2);
	const devMode = args.includes('--dev');
	const allPlatforms = args.includes('--all-platforms');

	console.log('🚀 AGI Desktop Build Script');
	console.log('===========================');

	try {
		if (allPlatforms) {
			// Build all platform binaries
			for (const platform of Object.keys(
				PLATFORMS,
			) as (keyof typeof PLATFORMS)[]) {
				const binaryPath = await buildCliBinary(platform);
				await copyBinaryToDesktop(binaryPath, platform);
			}
		} else {
			// Build for current platform only
			const platform = detectPlatform();
			console.log(`\n🔍 Detected platform: ${platform}`);

			const binaryPath = await buildCliBinary(platform);
			await copyBinaryToDesktop(binaryPath, platform);
		}

		if (!devMode) {
			await buildDesktopApp(false);

			console.log('\n✅ Build complete!');
			console.log('\n📦 Output locations:');
			console.log(
				'   macOS DMG:    apps/desktop/src-tauri/target/release/bundle/dmg/',
			);
			console.log(
				'   macOS App:    apps/desktop/src-tauri/target/release/bundle/macos/',
			);
			console.log(
				'   Windows MSI:  apps/desktop/src-tauri/target/release/bundle/msi/',
			);
			console.log(
				'   Linux:        apps/desktop/src-tauri/target/release/bundle/appimage/',
			);
		} else {
			console.log('\n✅ Dev build ready! Starting dev server...');
			await buildDesktopApp(true);
		}
	} catch (error) {
		console.error('\n❌ Build failed:', error);
		process.exit(1);
	}
}

main();
