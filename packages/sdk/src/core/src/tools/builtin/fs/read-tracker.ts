import { stat } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';

type FileStamp = {
	readAt: number;
	mtimeMs?: number;
	ctimeMs?: number;
	size?: number;
};

const readState = new Map<string, Map<string, FileStamp>>();

function getProjectState(projectRoot: string): Map<string, FileStamp> {
	const key = resolvePath(projectRoot);
	let state = readState.get(key);
	if (!state) {
		state = new Map<string, FileStamp>();
		readState.set(key, state);
	}
	return state;
}

async function captureFileStamp(absPath: string): Promise<FileStamp> {
	const stats = await stat(absPath);
	return {
		readAt: Date.now(),
		mtimeMs: Number.isFinite(stats.mtimeMs) ? stats.mtimeMs : undefined,
		ctimeMs: Number.isFinite(stats.ctimeMs) ? stats.ctimeMs : undefined,
		size: typeof stats.size === 'number' ? stats.size : undefined,
	};
}

export async function rememberFileRead(
	projectRoot: string,
	absPath: string,
): Promise<void> {
	const state = getProjectState(projectRoot);
	state.set(absPath, await captureFileStamp(absPath));
}

export async function rememberFileWrite(
	projectRoot: string,
	absPath: string,
): Promise<void> {
	const state = getProjectState(projectRoot);
	state.set(absPath, await captureFileStamp(absPath));
}

export async function assertFreshRead(
	projectRoot: string,
	absPath: string,
	displayPath: string,
): Promise<void> {
	const state = getProjectState(projectRoot);
	const previous = state.get(absPath);
	if (!previous) {
		throw new Error(
			`You must read file ${displayPath} before editing it. Use the read tool first.`,
		);
	}

	const current = await captureFileStamp(absPath);
	const changed =
		current.mtimeMs !== previous.mtimeMs ||
		current.ctimeMs !== previous.ctimeMs ||
		current.size !== previous.size;
	if (!changed) return;

	throw new Error(
		`File ${displayPath} has changed since it was last read. Read it again before editing.`,
	);
}
