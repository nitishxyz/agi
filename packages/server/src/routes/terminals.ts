import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { TerminalManager } from '@agi-cli/sdk';
import { logger } from '@agi-cli/sdk';

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
			logger.debug('POST /v1/terminals called');
			const body = await c.req.json();
			logger.debug('Creating terminal request received', body);
			const { command, args, purpose, cwd, title } = body;

			if (!command || !purpose) {
				return c.json({ error: 'command and purpose are required' }, 400);
			}

			let resolvedCommand = command;
			if (command === 'bash' || command === 'sh' || command === 'shell') {
				resolvedCommand = process.env.SHELL || '/bin/bash';
			}
			const resolvedCwd = cwd || process.cwd();

			logger.debug('Creating terminal', {
				command: resolvedCommand,
				args,
				purpose,
				cwd: resolvedCwd,
			});

			const terminal = terminalManager.create({
				command: resolvedCommand,
				args: args || [],
				purpose,
				cwd: resolvedCwd,
				createdBy: 'user',
				title,
			});

			logger.debug('Terminal created successfully', { id: terminal.id });

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

	app.get('/v1/terminals/:id/output', async (c) => {
		const id = c.req.param('id');
		logger.debug('SSE client connecting to terminal', { id });
		const terminal = terminalManager.get(id);

		if (!terminal) {
			logger.debug('SSE terminal not found', { id });
			return c.json({ error: 'Terminal not found' }, 404);
		}

		return streamSSE(c, async (stream) => {
			logger.debug('SSE stream started for terminal', { id });
			// Send historical buffer first (unless skipHistory is set)
			const skipHistory = c.req.query('skipHistory') === 'true';
			if (!skipHistory) {
				const history = terminal.read();
				logger.debug('SSE sending terminal history', {
					id,
					lines: history.length,
				});
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

			function cleanup() {
				terminal.removeDataListener(onData);
				terminal.removeExitListener(onExit);
				c.req.raw.signal.removeEventListener('abort', onAbort);
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
				logger.debug('SSE client disconnected from terminal', {
					id: terminal.id,
				});
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
	});

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
