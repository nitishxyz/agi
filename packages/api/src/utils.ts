/**
 * Utility functions for API client
 */

export interface ApiError {
	error: string;
	status: number;
	statusText: string;
}

/**
 * Check if an error is an API error response
 */
export function isApiError(error: unknown): error is ApiError {
	return (
		typeof error === 'object' &&
		error !== null &&
		'error' in error &&
		'status' in error &&
		typeof (error as ApiError).error === 'string' &&
		typeof (error as ApiError).status === 'number'
	);
}

/**
 * Handle API errors with consistent error messages
 */
export async function handleApiError(response: Response): Promise<never> {
	let errorMessage: string;

	try {
		const data = await response.json();
		errorMessage = data.error || response.statusText;
	} catch {
		errorMessage = response.statusText;
	}

	const error: ApiError = {
		error: errorMessage,
		status: response.status,
		statusText: response.statusText,
	};

	throw error;
}
