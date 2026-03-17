import type { Context } from 'hono';
import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { TerminalManager } from '@ottocode/sdk';
import { logger } from '@ottocode/sdk';

export function registerTerminalsRoutes(
	app: Hono,
	terminalManager: TerminalManager,
) {
	app.get('/v1/terminals', async (c) => {
		const terminals = terminalManager.list();
		return c.json({
			terminals: terminals.map((t) => t.toJSON()),
			count: terminals.length,
		});
	});

	app.post('/v1/terminals', async (c) => {
		try {
			const body = await c.req.json();
			const { command, args, purpose, cwd, title } = body;

			if (!command || !purpose) {
				return c.json({ error: 'command and purpose are required' }, 400);
			}

			let resolvedCommand = command;
			if (command === 'bash' || command === 'sh' || command === 'shell') {
				resolvedCommand =
					process.platform === 'win32'
						? process.env.COMSPEC || 'cmd.exe'
						: process.env.SHELL || '/bin/bash';
			}
			const resolvedCwd = cwd || process.cwd();

			const terminal = terminalManager.create({
				command: resolvedCommand,
				args: args || [],
				purpose,
				cwd: resolvedCwd,
				createdBy: 'user',
				title,
			});

			return c.json({
				terminalId: terminal.id,
				pid: terminal.pid,
				purpose: terminal.purpose,
				command: terminal.command,
			});
		} catch (error) {
			logger.error('Error creating terminal', error);
			const message = error instanceof Error ? error.message : String(error);
			return c.json({ error: message }, 500);
		}
	});

	app.get('/v1/terminals/:id', async (c) => {
		const id = c.req.param('id');
		const terminal = terminalManager.get(id);

		if (!terminal) {
			return c.json({ error: 'Terminal not found' }, 404);
		}

		return c.json({ terminal: terminal.toJSON() });
	});

	const handleTerminalOutput = async (c: Context) => {
		const id = c.req.param('id');
		const terminal = terminalManager.get(id);

		if (!terminal) {
			return c.json({ error: 'Terminal not found' }, 404);
		}

		const activeTerminal = terminal;

		return streamSSE(c, async (stream) => {
			const skipHistory = c.req.query('skipHistory') === 'true';
			if (!skipHistory) {
				const history = activeTerminal.read();
				for (const line of history) {
					await stream.write(
						`data: ${JSON.stringify({ type: 'data', line })}\n\n`,
					);
				}
			}

			const sendEvent = async (payload: Record<string, unknown>) => {
				try {
					await stream.write(`data: ${JSON.stringify(payload)}\n\n`);
				} catch (error) {
					logger.error('SSE error writing event', error, { id });
				}
			};

			const onData = (line: string) => {
				void sendEvent({ type: 'data', line });
			};

			let resolveStream: (() => void) | null = null;
			let finished = false;

			const hb = setInterval(async () => {
				try {
					await stream.write(`: hb ${Date.now()}\n\n`);
				} catch {
					clearInterval(hb);
				}
			}, 15000);

			function cleanup() {
				activeTerminal.removeDataListener(onData);
				activeTerminal.removeExitListener(onExit);
				c.req.raw.signal.removeEventListener('abort', onAbort);
				clearInterval(hb);
			}

			function finish() {
				if (finished) {
					return;
				}
				finished = true;
				cleanup();
				resolveStream?.();
			}

			async function onExit(exitCode: number) {
				try {
					await sendEvent({ type: 'exit', exitCode });
				} finally {
					stream.close();
					finish();
				}
			}

			function onAbort() {
				stream.close();
				finish();
			}

			terminal.onData(onData);
			terminal.onExit(onExit);

			c.req.raw.signal.addEventListener('abort', onAbort, { once: true });

			const waitForClose = new Promise<void>((resolve) => {
				resolveStream = resolve;
			});

			if (terminal.status === 'exited') {
				void onExit(terminal.exitCode ?? 0);
			}

			await waitForClose;
		});
	};

	app.get('/v1/terminals/:id/output', handleTerminalOutput);
	app.post('/v1/terminals/:id/output', handleTerminalOutput);

	app.post('/v1/terminals/:id/input', async (c) => {
		const id = c.req.param('id');
		const terminal = terminalManager.get(id);

		if (!terminal) {
			return c.json({ error: 'Terminal not found' }, 404);
		}

		try {
			const body = await c.req.json();
			const { input } = body;

			if (!input) {
				return c.json({ error: 'input is required' }, 400);
			}

			terminal.write(input);
			return c.json({ success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return c.json({ error: message }, 500);
		}
	});

	app.delete('/v1/terminals/:id', async (c) => {
		const id = c.req.param('id');

		try {
			await terminalManager.kill(id);
			return c.json({ success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return c.json({ error: message }, 500);
		}
	});

	app.post('/v1/terminals/:id/resize', async (c) => {
		const id = c.req.param('id');
		const terminal = terminalManager.get(id);

		if (!terminal) {
			return c.json({ error: 'Terminal not found' }, 404);
		}

		try {
			const body = await c.req.json();
			const { cols, rows } = body;

			if (!cols || !rows || cols < 1 || rows < 1) {
				return c.json({ error: 'valid cols and rows are required' }, 400);
			}

			terminal.resize(cols, rows);
			return c.json({ success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return c.json({ error: message }, 500);
		}
	});
}
