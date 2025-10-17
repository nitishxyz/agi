import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

function resolveLibraryFilename(): string {
	const platform = process.platform;
	const arch = process.arch;

	if (platform === 'darwin') {
		return arch === 'arm64' ? 'librust_pty_arm64.dylib' : 'librust_pty.dylib';
	}

	if (platform === 'win32') {
		return 'rust_pty.dll';
	}

	return arch === 'arm64' ? 'librust_pty_arm64.so' : 'librust_pty.so';
}

function tryUseExistingPath(path?: string | null): string | null {
	if (!path) return null;
	if (existsSync(path)) {
		process.env.BUN_PTY_LIB = path;
		return path;
	}
	return null;
}

async function readFromEmbedded(
	url: URL,
	targetPath: string,
): Promise<string | null> {
	const file = Bun.file(url);
	if (!(await file.exists())) {
		return null;
	}

	const dir = dirname(targetPath);
	mkdirSync(dir, { recursive: true });
	await Bun.write(targetPath, file);
	process.env.BUN_PTY_LIB = targetPath;
	return targetPath;
}

export async function ensureBunPtyLibrary(): Promise<string | null> {
	const already = tryUseExistingPath(process.env.BUN_PTY_LIB);
	if (already) return already;

	const filename = resolveLibraryFilename();
	const candidates: string[] = [];

	let pkgUrl: string | null = null;
	try {
		pkgUrl = await import.meta.resolve('bun-pty/package.json');
		const pkgPath = fileURLToPath(pkgUrl);
		const pkgDir = dirname(pkgPath);
		candidates.push(
			join(pkgDir, 'rust-pty', 'target', 'release', filename),
			join(pkgDir, '..', 'bun-pty', 'rust-pty', 'target', 'release', filename),
		);
	} catch {
		// ignore resolution failures
	}

	candidates.push(
		join(
			process.cwd(),
			'node_modules',
			'bun-pty',
			'rust-pty',
			'target',
			'release',
			filename,
		),
	);

	for (const candidate of candidates) {
		const path = tryUseExistingPath(candidate);
		if (path) return path;
	}

	if (pkgUrl) {
		const embeddedUrl = new URL(
			`./rust-pty/target/release/${filename}`,
			pkgUrl,
		);
		const tmpPath = join(tmpdir(), 'agi-cli', 'bun-pty', filename);
		const fromEmbedded = await readFromEmbedded(embeddedUrl, tmpPath);
		if (fromEmbedded) return fromEmbedded;
	}

	return null;
}
