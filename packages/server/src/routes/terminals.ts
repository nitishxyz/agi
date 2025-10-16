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
			console.error('[API] Error stack:', error instanceof Error ? error.stack : 'No stack');
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
		const terminal = terminalManager.get(id);

		if (!terminal) {
			return c.json({ error: 'Terminal not found' }, 404);
		}

		return streamSSE(c, async (stream) => {
			const onData = (line: string) => {
				stream.write(JSON.stringify({ type: 'data', line }));
			};

			const onExit = (exitCode: number) => {
				stream.write(JSON.stringify({ type: 'exit', exitCode }));
				stream.close();
			};

			terminal.onData(onData);
			terminal.onExit(onExit);

			c.req.raw.signal.addEventListener('abort', () => {
				terminal.removeDataListener(onData);
				terminal.removeExitListener(onExit);
			});

			if (terminal.status === 'exited') {
				stream.write(
					JSON.stringify({
						type: 'exit',
						exitCode: terminal.exitCode,
					}),
				);
				stream.close();
			}
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
