import type { WalletContext } from './auth.ts';
import type { FetchFunction } from './types.ts';

const DEFAULT_TOKEN_REFRESH_SKEW_MS = 60_000;
const DEFAULT_TOKEN_TTL_MS = 5 * 60_000;

interface AccessTokenState {
	token: string;
	expiresAt: number;
}

export interface AccessTokenManager {
	getToken(forceRefresh?: boolean): Promise<string>;
	invalidate(): void;
}

interface CreateAccessTokenManagerOptions {
	wallet: WalletContext;
	baseURL: string;
	fetch?: FetchFunction;
	tokenRefreshSkewMs?: number;
}

interface WalletTokenResponse {
	accessToken?: string;
	access_token?: string;
	token?: string;
	expiresAt?: number | string;
	expires_at?: number | string;
	expiresIn?: number | string;
	expires_in?: number | string;
}

function trimTrailingSlash(url: string) {
	return url.endsWith('/') ? url.slice(0, -1) : url;
}

function parseNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim()) {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return null;
}

function parseJwtExpiry(token: string): number | null {
	const parts = token.split('.');
	if (parts.length < 2) return null;
	try {
		const base64 = parts[1]?.replace(/-/g, '+').replace(/_/g, '/');
		if (!base64) return null;
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
		const json = JSON.parse(atob(padded)) as {
			exp?: unknown;
		};
		const exp = parseNumber(json.exp);
		return exp != null ? exp * 1000 : null;
	} catch {
		return null;
	}
}

function resolveExpiresAt(payload: WalletTokenResponse, token: string): number {
	const expiresAt = parseNumber(payload.expiresAt ?? payload.expires_at);
	if (expiresAt != null) {
		return expiresAt > 1_000_000_000_000 ? expiresAt : expiresAt * 1000;
	}

	const expiresIn = parseNumber(payload.expiresIn ?? payload.expires_in);
	if (expiresIn != null) {
		return Date.now() + expiresIn * 1000;
	}

	return parseJwtExpiry(token) ?? Date.now() + DEFAULT_TOKEN_TTL_MS;
}

async function exchangeWalletToken(
	wallet: WalletContext,
	baseURL: string,
	baseFetch: FetchFunction,
): Promise<AccessTokenState> {
	const walletHeaders = await (
		wallet.buildWalletAuthHeaders ?? wallet.buildHeaders
	)();
	const response = await baseFetch(
		`${trimTrailingSlash(baseURL)}/v1/auth/wallet-token`,
		{
			method: 'POST',
			headers: walletHeaders,
		},
	);

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new Error(
			`Setu: wallet token exchange failed (${response.status})${body ? `: ${body}` : ''}`,
		);
	}

	const payload = (await response.json()) as WalletTokenResponse;
	const token = payload.accessToken ?? payload.access_token ?? payload.token;
	if (!token) {
		throw new Error(
			'Setu: wallet token exchange response missing access token.',
		);
	}

	return {
		token,
		expiresAt: resolveExpiresAt(payload, token),
	};
}

export function createAccessTokenManager(
	options: CreateAccessTokenManagerOptions,
): AccessTokenManager {
	const {
		wallet,
		baseURL,
		fetch: customFetch,
		tokenRefreshSkewMs = DEFAULT_TOKEN_REFRESH_SKEW_MS,
	} = options;
	const baseFetch = customFetch ?? globalThis.fetch.bind(globalThis);
	let state: AccessTokenState | null = null;
	let inFlight: Promise<string> | null = null;

	const hasValidToken = () =>
		state != null && Date.now() + tokenRefreshSkewMs < state.expiresAt;

	const refresh = async () => {
		const next = await exchangeWalletToken(wallet, baseURL, baseFetch);
		state = next;
		return next.token;
	};

	return {
		async getToken(forceRefresh = false) {
			if (!forceRefresh && hasValidToken() && state) {
				return state.token;
			}

			if (!inFlight) {
				inFlight = refresh().finally(() => {
					inFlight = null;
				});
			}

			return inFlight;
		},
		invalidate() {
			state = null;
		},
	};
}
