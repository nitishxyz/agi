import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

type Mode = 'max' | 'console';

// Custom PKCE implementation using synchronous crypto
function generatePKCE() {
	// Generate random verifier (43-128 characters, base64url encoded)
	const verifier = randomBytes(32)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');

	// Generate challenge from verifier (SHA-256 hash, base64url encoded)
	const challenge = createHash('sha256')
		.update(verifier)
		.digest('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');

	return { verifier, challenge };
}

async function openBrowser(url: string) {
	const platform = process.platform;
	let command: string;

	switch (platform) {
		case 'darwin':
			command = `open "${url}"`;
			break;
		case 'win32':
			command = `start "${url}"`;
			break;
		default:
			command = `xdg-open "${url}"`;
			break;
	}

	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, [], { shell: true });
		child.on('error', reject);
		child.on('exit', (code) => {
			if (code === 0) resolve();
			else reject(new Error(`Failed to open browser (exit code ${code})`));
		});
	});
}

export async function authorize(mode: Mode) {
	const pkce = generatePKCE();

	const url = new URL(
		`https://${mode === 'console' ? 'console.anthropic.com' : 'claude.ai'}/oauth/authorize`,
	);
	url.searchParams.set('code', 'true');
	url.searchParams.set('client_id', CLIENT_ID);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set(
		'redirect_uri',
		'https://console.anthropic.com/oauth/code/callback',
	);
	url.searchParams.set(
		'scope',
		'org:create_api_key user:profile user:inference',
	);
	url.searchParams.set('code_challenge', pkce.challenge);
	url.searchParams.set('code_challenge_method', 'S256');
	url.searchParams.set('state', pkce.verifier);

	return {
		url: url.toString(),
		verifier: pkce.verifier,
	};
}

export async function exchange(code: string, verifier: string) {
	const splits = code.split('#');
	const result = await fetch('https://console.anthropic.com/v1/oauth/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			code: splits[0],
			state: splits[1],
			grant_type: 'authorization_code',
			client_id: CLIENT_ID,
			redirect_uri: 'https://console.anthropic.com/oauth/code/callback',
			code_verifier: verifier,
		}),
	});

	if (!result.ok) {
		const error = await result.text();
		throw new Error(`Token exchange failed: ${error}`);
	}

	const json = (await result.json()) as {
		refresh_token: string;
		access_token: string;
		expires_in: number;
	};
	return {
		refresh: json.refresh_token,
		access: json.access_token,
		expires: Date.now() + json.expires_in * 1000,
	};
}

export async function refreshToken(refreshToken: string) {
	const response = await fetch('https://console.anthropic.com/v1/oauth/token', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			grant_type: 'refresh_token',
			refresh_token: refreshToken,
			client_id: CLIENT_ID,
		}),
	});

	if (!response.ok) {
		throw new Error('Failed to refresh token');
	}

	const json = (await response.json()) as {
		refresh_token: string;
		access_token: string;
		expires_in: number;
	};
	return {
		refresh: json.refresh_token,
		access: json.access_token,
		expires: Date.now() + json.expires_in * 1000,
	};
}

export async function openAuthUrl(url: string) {
	try {
		await openBrowser(url);
		return true;
	} catch {
		return false;
	}
}

export async function createApiKey(accessToken: string) {
	const result = await fetch(
		'https://api.anthropic.com/api/oauth/claude_cli/create_api_key',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				authorization: `Bearer ${accessToken}`,
			},
		},
	);

	if (!result.ok) {
		const error = await result.text();
		throw new Error(`Failed to create API key: ${error}`);
	}

	const json = (await result.json()) as { raw_key: string };
	return json.raw_key;
}
