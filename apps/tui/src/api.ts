import { client } from '@ottocode/api';

const DEFAULT_PORT = 9100;

export function getBaseUrl(): string {
	const port = process.env.OTTO_PORT || String(DEFAULT_PORT);
	return `http://localhost:${port}`;
}

export function configureApi() {
	client.setConfig({
		baseURL: getBaseUrl(),
	});
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${getBaseUrl()}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers,
		},
	});
	if (!res.ok) {
		throw new Error(`API error ${res.status}: ${res.statusText}`);
	}
	return res.json() as Promise<T>;
}
