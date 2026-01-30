import {
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	chmodSync,
} from 'node:fs';
import { join } from 'node:path';
import { embeddedRg } from './generated/embedded-rg.ts';

function getAgiBinDir(): string {
	const cfgHome = process.env.XDG_CONFIG_HOME;
	const home = process.env.HOME || process.env.USERPROFILE || '';
	const configBase = cfgHome?.trim() || join(home, '.config');
	return join(configBase, 'agi', 'bin');
}

const MIN_BINARY_SIZE = 100_000;

export function bootstrapBinaries(): void {
	if (!embeddedRg) return;

	const binDir = getAgiBinDir();
	const rgName = process.platform === 'win32' ? 'rg.exe' : 'rg';
	const rgDest = join(binDir, rgName);

	if (existsSync(rgDest)) return;

	let buf: Buffer;
	try {
		buf = readFileSync(embeddedRg);
		if (buf.length < MIN_BINARY_SIZE) return;
	} catch {
		return;
	}

	try {
		mkdirSync(binDir, { recursive: true });
		writeFileSync(rgDest, buf);
		if (process.platform !== 'win32') {
			chmodSync(rgDest, 0o755);
		}
	} catch {}
}
