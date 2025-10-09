/**
 * API Client Factory
 *
 * Creates a configured API client instance with proper base URL and options.
 */

export interface ApiClientConfig {
	/**
	 * Base URL for the API server
	 * @default 'http://localhost:9100'
	 */
	baseUrl?: string;

	/**
	 * Project path to send with requests
	 * If omitted, the server uses its current working directory
	 */
	projectPath?: string;

	/**
	 * Custom fetch implementation (useful for testing or custom auth)
	 */
	fetch?: typeof fetch;

	/**
	 * Additional headers to include with every request
	 */
	headers?: Record<string, string>;
}

/**
 * Create a configured API client instance
 *
 * @example
 * ```typescript
 * import { createApiClient } from '@agi-cli/api';
 *
 * const api = createApiClient({
 *   baseUrl: 'http://localhost:9100',
 *   projectPath: '/path/to/project'
 * });
 *
 * // List sessions
 * const sessions = await api.sessions.list();
 *
 * // Create a session
 * const session = await api.sessions.create({
 *   agent: 'code',
 *   provider: 'anthropic',
 *   model: 'claude-3-5-sonnet-20241022'
 * });
 *
 * // Send a message
 * await api.messages.create(session.id, {
 *   content: 'Hello, world!'
 * });
 * ```
 */
export function createApiClient(config: ApiClientConfig = {}) {
	const {
		baseUrl = 'http://localhost:9100',
		projectPath,
		fetch: customFetch,
		headers: customHeaders,
	} = config;

	// Create base fetch wrapper that adds project path and custom headers
	const fetchWrapper: typeof fetch = async (input, init) => {
		const url = new URL(
			typeof input === 'string' ? input : input.url,
			baseUrl
		);

		// Add project query parameter if provided
		if (projectPath) {
			url.searchParams.set('project', projectPath);
		}

		// Merge headers
		const headers = new Headers(init?.headers);
		if (customHeaders) {
			for (const [key, value] of Object.entries(customHeaders)) {
				headers.set(key, value);
			}
		}

		const fetchImpl = customFetch || fetch;
		return fetchImpl(url.toString(), {
			...init,
			headers,
		});
	};

	// Return API methods
	return {
		/**
		 * Session management
		 */
		sessions: {
			/**
			 * List all sessions for the project
			 */
			async list() {
				const response = await fetchWrapper(`${baseUrl}/v1/sessions`);
				if (!response.ok) {
					throw new Error(`Failed to list sessions: ${response.statusText}`);
				}
				return response.json();
			},

			/**
			 * Create a new session
			 */
			async create(options?: {
				title?: string | null;
				agent?: string;
				provider?: string;
				model?: string;
			}) {
				const response = await fetchWrapper(`${baseUrl}/v1/sessions`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(options || {}),
				});
				if (!response.ok) {
					throw new Error(`Failed to create session: ${response.statusText}`);
				}
				return response.json();
			},
		},

		/**
		 * Message management
		 */
		messages: {
			/**
			 * List messages for a session
			 */
			async list(sessionId: string, options?: { without?: 'parts' }) {
				const url = new URL(`${baseUrl}/v1/sessions/${sessionId}/messages`);
				if (options?.without) {
					url.searchParams.set('without', options.without);
				}
				const response = await fetchWrapper(url.toString());
				if (!response.ok) {
					throw new Error(`Failed to list messages: ${response.statusText}`);
				}
				return response.json();
			},

			/**
			 * Create a user message and enqueue assistant run
			 */
			async create(
				sessionId: string,
				options: {
					content: string;
					agent?: string;
					provider?: string;
					model?: string;
				}
			) {
				const response = await fetchWrapper(
					`${baseUrl}/v1/sessions/${sessionId}/messages`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(options),
					}
				);
				if (!response.ok) {
					throw new Error(`Failed to create message: ${response.statusText}`);
				}
				return response.json();
			},
		},

		/**
		 * Ask service (simplified CLI-style endpoint)
		 */
		ask: {
			/**
			 * Send a prompt using the ask service
			 */
			async send(options: {
				prompt: string;
				agent?: string;
				provider?: string;
				model?: string;
				sessionId?: string;
				last?: boolean;
				jsonMode?: boolean;
			}) {
				const response = await fetchWrapper(`${baseUrl}/v1/ask`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(options),
				});
				if (!response.ok) {
					throw new Error(`Failed to send ask request: ${response.statusText}`);
				}
				return response.json();
			},
		},

		/**
		 * Configuration
		 */
		baseUrl,
		projectPath,
		fetchWrapper,
	};
}

/**
 * Type helper for API client instance
 */
export type ApiClient = ReturnType<typeof createApiClient>;
