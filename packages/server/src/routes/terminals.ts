import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { TerminalManager } from '@agi-cli/sdk';

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
			console.log('[API] POST /v1/terminals called');
			const body = await c.req.json();
			console.log('[API] Request body:', body);
			const { command, args, purpose, cwd, title } = body;

			if (!command || !purpose) {
				return c.json({ error: 'command and purpose are required' }, 400);
			}

			let resolvedCommand = command;
			if (command === 'bash' || command === 'sh' || command === 'shell') {
				resolvedCommand = process.env.SHELL || '/bin/bash';
			}
			const resolvedCwd = cwd || process.cwd();

			console.log('[API] Creating terminal with:', {
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

			console.log('[API] Terminal created successfully:', terminal.id);

			return c.json({
				terminalId: terminal.id,
				pid: terminal.pid,
				purpose: terminal.purpose,
				command: terminal.command,
			});
		} catch (error) {
			console.error('[API] Error creating terminal:', error);
			console.error(
				'[API] Error stack:',
				error instanceof Error ? error.stack : 'No stack',
			);
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
		console.log('[SSE] Client connecting to terminal:', id);
		const terminal = terminalManager.get(id);

		if (!terminal) {
			console.error('[SSE] Terminal not found:', id);
			return c.json({ error: 'Terminal not found' }, 404);
		}

		return streamSSE(c, async (stream) => {
			console.log('[SSE] Stream started for terminal:', id);
			// Send historical buffer first (unless skipHistory is set)
			const skipHistory = c.req.query('skipHistory') === 'true';
			if (!skipHistory) {
				const history = terminal.read();
				console.log('[SSE] Sending history, lines:', history.length);
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
					console.error('[SSE] Error writing event:', error);
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
				console.log('[SSE] Client disconnected:', terminal.id);
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
}
