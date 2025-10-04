// Extend Window interface to include custom properties
interface AGIWindow extends Window {
	__AGI_API_URL__?: string;
	AGI_SERVER_URL?: string;
}

// This function will execute at runtime in the browser
function getApiBaseUrl(): string {
	// Check Vite env var first (for dev mode)
	if (import.meta.env.VITE_API_BASE_URL) {
		return import.meta.env.VITE_API_BASE_URL;
	}
	
	// Check window object for injected values (for production)
	const win = window as AGIWindow;
	if (win.AGI_SERVER_URL) {
		return win.AGI_SERVER_URL;
	}
	if (win.__AGI_API_URL__) {
		return win.__AGI_API_URL__;
	}
	
	// Fallback for standalone dev
	return 'http://localhost:9100';
}

export const API_BASE_URL = getApiBaseUrl();

export const config = {
	apiBaseUrl: API_BASE_URL,
};
