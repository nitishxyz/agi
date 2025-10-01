import { createApp } from '@agi-cli/server';

let currentServer: ReturnType<typeof Bun.serve> | null = null;

export async function startEphemeralServer(): Promise<string> {
	if (currentServer) return `http://localhost:${currentServer.port}`;
	const app = createApp();
	currentServer = Bun.serve({ port: 0, fetch: app.fetch, idleTimeout: 240 });
	return `http://localhost:${currentServer.port}`;
}

export async function getOrStartServerUrl(): Promise<string> {
	if (process.env.AGI_SERVER_URL) return String(process.env.AGI_SERVER_URL);
	return await startEphemeralServer();
}

export async function stopEphemeralServer(): Promise<void> {
	if (currentServer) {
		try {
			currentServer.stop();
		} catch {}
		currentServer = null;
	}
}
