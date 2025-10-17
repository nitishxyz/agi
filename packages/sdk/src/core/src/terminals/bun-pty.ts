import { ensureBunPtyLibrary } from './ensure-bun-pty.ts';

await ensureBunPtyLibrary();

const bunPty = await import('bun-pty');

export const spawn = bunPty.spawn;

export type {
	IPty,
	IPtyForkOptions as PtyOptions,
	IExitEvent,
} from 'bun-pty';
