import { existsSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const APP_NAME = 'otto';

function getDesktopAppPath(): string | null {
	const os = platform();

	if (os === 'darwin') {
		const candidates = [
			`/Applications/${APP_NAME}.app`,
			join(homedir(), 'Applications', `${APP_NAME}.app`),
		];
		for (const p of candidates) {
			if (existsSync(p)) return p;
		}
	}

	if (os === 'linux') {
		const candidates = [
			'/usr/bin/otto-desktop',
			'/usr/local/bin/otto-desktop',
			join(homedir(), '.local', 'bin', 'otto-desktop'),
			'/opt/otto-desktop/otto-desktop',
		];
		for (const p of candidates) {
			if (existsSync(p)) return p;
		}
	}

	if (os === 'win32') {
		const candidates = [
			join(
				process.env.LOCALAPPDATA || '',
				'Programs',
				APP_NAME,
				`${APP_NAME}.exe`,
			),
			join(
				process.env.PROGRAMFILES || 'C:\\Program Files',
				APP_NAME,
				`${APP_NAME}.exe`,
			),
		];
		for (const p of candidates) {
			if (existsSync(p)) return p;
		}
	}

	return null;
}

export function isDesktopInstalled(): boolean {
	return getDesktopAppPath() !== null;
}

export function openDesktop(projectPath: string): boolean {
	const appPath = getDesktopAppPath();
	if (!appPath) return false;

	const os = platform();

	try {
		if (os === 'darwin') {
			spawn('open', [appPath, '--args', '--project', projectPath], {
				detached: true,
				stdio: 'ignore',
			}).unref();
		} else if (os === 'win32') {
			spawn(appPath, ['--project', projectPath], {
				detached: true,
				stdio: 'ignore',
			}).unref();
		} else {
			spawn(appPath, ['--project', projectPath], {
				detached: true,
				stdio: 'ignore',
			}).unref();
		}
		return true;
	} catch {
		return false;
	}
}
