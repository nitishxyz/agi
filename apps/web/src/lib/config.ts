export const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ||
	(window as any).__AGI_API_URL__ ||
	'http://localhost:9100';

export const config = {
	apiBaseUrl: API_BASE_URL,
};
