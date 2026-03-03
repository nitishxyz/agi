const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

let getAuthTokenFn: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
	getAuthTokenFn = getter;
}

export function clearAuthTokenGetter() {
	getAuthTokenFn = null;
}

export async function getAuthToken(): Promise<string | null> {
	if (!getAuthTokenFn) return null;
	return getAuthTokenFn();
}

export async function apiRequest<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const token = await getAuthToken();

	const url = `${API_URL}${path}`;
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...options.headers,
	};

	const response = await fetch(url, {
		...options,
		headers,
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error || `Request failed: ${response.statusText}`);
	}

	return response.json();
}

export async function publicApiRequest<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const url = `${API_URL}${path}`;
	const headers: HeadersInit = {
		'Content-Type': 'application/json',
		...options.headers,
	};

	const response = await fetch(url, {
		...options,
		headers,
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error || `Request failed: ${response.statusText}`);
	}

	return response.json();
}

export { API_URL };
