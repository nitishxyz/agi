import { createApp } from '@ottocode/server';
import { client } from '@ottocode/api';

let currentServer: ReturnType<typeof Bun.serve> | null = null;
let configured = false;

export async function startEphemeralServer(): Promise<string> {
	if (currentServer) return `http://localhost:${currentServer.port}`;
	const app = createApp();
	currentServer = Bun.serve({ port: 0, fetch: app.fetch, idleTimeout: 240 });
	const url = `http://localhost:${currentServer.port}`;
	configureClient(url);
	return url;
}

export async function getOrStartServerUrl(): Promise<string> {
	if (process.env.OTTO_SERVER_URL) {
		const url = String(process.env.OTTO_SERVER_URL);
		configureClient(url);
		return url;
	}
	return await startEphemeralServer();
}

export async function ensureServer(): Promise<string> {
	return await getOrStartServerUrl();
}

export async function stopEphemeralServer(): Promise<void> {
	if (currentServer) {
		try {
			currentServer.stop();
		} catch {}
		currentServer = null;
	}
}

function configureClient(baseURL: string) {
	if (configured) return;
	client.setConfig({ baseURL });
	configured = true;
}
