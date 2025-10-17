// Extend Window interface to include custom properties
interface AGIWindow extends Window {
	__AGI_API_URL__?: string;
	AGI_SERVER_URL?: string;
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
		const win = window as AGIWindow;
		if (win.AGI_SERVER_URL) {
			return win.AGI_SERVER_URL;
		}
		if (win.__AGI_API_URL__) {
			return win.__AGI_API_URL__;
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
