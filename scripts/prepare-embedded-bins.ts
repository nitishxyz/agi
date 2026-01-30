#!/usr/bin/env bun
import { existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..');
const CLI_DIR = join(ROOT, 'apps', 'cli');
const VENDOR_BIN = join(ROOT, 'vendor', 'bin');
const CLI_VENDOR = join(CLI_DIR, 'vendor');
const GENERATED_DIR = join(CLI_DIR, 'src', 'generated');

function getPlatformKey(target?: string): string {
	if (target) {
		const map: Record<string, string> = {
			'bun-darwin-arm64': 'darwin-arm64',
			'bun-darwin-x64': 'darwin-x64',
			'bun-linux-x64': 'linux-x64',
			'bun-linux-arm64': 'linux-arm64',
			'darwin-arm64': 'darwin-arm64',
			'darwin-x64': 'darwin-x64',
			'linux-x64': 'linux-x64',
			'linux-arm64': 'linux-arm64',
			'aarch64-apple-darwin': 'darwin-arm64',
			'x86_64-apple-darwin': 'darwin-x64',
			'x86_64-unknown-linux-gnu': 'linux-x64',
			'x86_64-unknown-linux-musl': 'linux-x64',
			'aarch64-unknown-linux-gnu': 'linux-arm64',
		};
		if (map[target]) return map[target];
	}
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

const targetArg = process.argv[2];
const platformKey = getPlatformKey(targetArg);
const isWindows = platformKey.startsWith('windows');
const rgName = isWindows ? 'rg.exe' : 'rg';

const rgSource = join(VENDOR_BIN, platformKey, rgName);
const rgDest = join(CLI_VENDOR, rgName);

mkdirSync(CLI_VENDOR, { recursive: true });
mkdirSync(GENERATED_DIR, { recursive: true });

let hasRg = false;

if (existsSync(rgSource)) {
	copyFileSync(rgSource, rgDest);
	hasRg = true;
	console.log(`Copied ${platformKey}/${rgName} to apps/cli/vendor/`);
} else {
	console.log(`No vendor binary at ${rgSource} — embedded rg will be null`);
}

const generatedFile = join(GENERATED_DIR, 'embedded-rg.ts');

if (hasRg) {
	writeFileSync(
		generatedFile,
		`import embeddedRgPath from '../../vendor/${rgName}' with { type: 'file' };\nexport const embeddedRg: string | null = embeddedRgPath;\n`,
	);
	console.log('Generated embedded-rg.ts (with binary)');
} else {
	writeFileSync(
		generatedFile,
		`export const embeddedRg: string | null = null;\n`,
	);
	console.log('Generated embedded-rg.ts (null — no binary available)');
}
