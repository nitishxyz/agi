// Extend Window interface to include custom properties
interface OttoWindow extends Window {
	__OTTO_API_URL__?: string;
	OTTO_SERVER_URL?: string;
}

// This function will execute at runtime in the browser
function computeApiBaseUrl(): string {
	// Check Vite env var first (for dev mode)
	const envUrl = import.meta.env?.VITE_API_BASE_URL;
	if (envUrl) {
		return envUrl;
	}

	// Check window object for injected values (for production)
	if (typeof window !== 'undefined') {
		const win = window as OttoWindow;
		if (win.OTTO_SERVER_URL) {
			return win.OTTO_SERVER_URL;
		}
		if (win.__OTTO_API_URL__) {
			return win.__OTTO_API_URL__;
		}
	}

	// Fallback for standalone dev
	return 'http://localhost:9100';
}

export function getRuntimeApiBaseUrl(): string {
	return computeApiBaseUrl();
}

export const API_BASE_URL = computeApiBaseUrl();

export const config = {
	apiBaseUrl: API_BASE_URL,
};
