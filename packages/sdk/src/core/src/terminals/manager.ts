import { randomBytes } from 'node:crypto';
import type { PtyOptions } from './bun-pty.ts';
import { spawn as spawnPty } from './bun-pty.ts';
import { Terminal } from './terminal.ts';
import { logger } from '../utils/logger.ts';
import { getAugmentedPath } from '../tools/bin-manager.ts';

const MAX_TERMINALS = 10;
const CLEANUP_DELAY_MS = 5 * 60 * 1000;

export interface CreateTerminalOptions {
	command: string;
	args?: string[];
	cwd: string;
	purpose: string;
	createdBy: 'user' | 'llm';
	title?: string;
}

export class TerminalManager {
	private terminals = new Map<string, Terminal>();
	private cleanupTimers = new Map<string, NodeJS.Timeout>();

	create(options: CreateTerminalOptions): Terminal {
		if (this.terminals.size >= MAX_TERMINALS) {
			throw new Error(`Maximum ${MAX_TERMINALS} terminals reached`);
		}

		const id = this.generateId();

		try {
			logger.debug('TerminalManager: creating terminal', {
				id,
				command: options.command,
				args: options.args,
				cwd: options.cwd,
				purpose: options.purpose,
			});

			const ptyOptions: PtyOptions = {
				name: 'xterm-256color',
				cols: 80,
				rows: 30,
				cwd: options.cwd,
				env: {
					...process.env,
					PATH: getAugmentedPath(),
				} as Record<string, string>,
			};

			const pty = spawnPty(options.command, options.args || [], ptyOptions);

			logger.debug('TerminalManager: PTY created', {
				pid: pty.pid,
			});

			const terminal = new Terminal(id, pty, options);

			if (options.command.includes('zsh')) {
				setTimeout(() => {
					pty.write(' unsetopt prompt_sp 2>/dev/null\r');
					setTimeout(() => {
						pty.write(' clear\r');
						terminal.clearBuffer();
					}, 200);
				}, 100);
			}

			terminal.onExit((_exitCode) => {
				const timer = setTimeout(() => {
					this.delete(id);
				}, CLEANUP_DELAY_MS);

				this.cleanupTimers.set(id, timer);
			});

			this.terminals.set(id, terminal);

			logger.debug('TerminalManager: terminal added to map', { id });

			return terminal;
		} catch (error) {
			logger.error('TerminalManager: failed to create terminal', error);
			throw error;
		}
	}

	get(id: string): Terminal | undefined {
		return this.terminals.get(id);
	}

	list(): Terminal[] {
		return Array.from(this.terminals.values());
	}

	async kill(id: string): Promise<void> {
		const terminal = this.terminals.get(id);
		if (!terminal) {
			throw new Error(`Terminal ${id} not found`);
		}

		terminal.kill();

		await new Promise<void>((resolve) => {
			if (terminal.status === 'exited') {
				resolve();
				return;
			}

			const exitHandler = () => {
				terminal.removeExitListener(exitHandler);
				resolve();
			};

			terminal.onExit(exitHandler);

			setTimeout(() => {
				terminal.removeExitListener(exitHandler);
				resolve();
			}, 5000);
		});

		this.delete(id);
	}

	async killAll(): Promise<void> {
		const killPromises = Array.from(this.terminals.keys()).map((id) =>
			this.kill(id).catch((err) =>
				logger.error(`Failed to kill terminal ${id}`, err),
			),
		);

		await Promise.all(killPromises);
	}

	delete(id: string): boolean {
		const timer = this.cleanupTimers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.cleanupTimers.delete(id);
		}

		return this.terminals.delete(id);
	}

	private generateId(): string {
		return `term-${randomBytes(8).toString('hex')}`;
	}

	getContext(): string {
		const terminals = this.list();

		if (terminals.length === 0) {
			return '';
		}

		const summary = terminals
			.map(
				(t) =>
					`- [${t.id}] ${t.purpose} (${t.status}, ${t.createdBy}, pid: ${t.pid})`,
			)
			.join('\n');

		return `\n\n## Active Terminals (${terminals.length}):\n${summary}\n\nYou can read from any terminal using the 'terminal' tool with operation: 'read'.`;
	}
}
