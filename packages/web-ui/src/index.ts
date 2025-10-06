import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Embedded assets map - populated at build time
const EMBEDDED_ASSETS = new Map<
	string,
	{ content: string; contentType: string }
>();

type MaybePromise<T> = T | Promise<T>;

type ApiBaseUrlOption =
	| string
	| URL
	| ((context: {
			req: Request;
	  }) => MaybePromise<string | URL | null | undefined>);

/**
 * Get the absolute path to the web UI assets directory
 */
export function getWebUIPath(): string {
	return join(__dirname, 'web-assets');
}

/**
 * Get the absolute path to the index.html file
 */
export function getIndexPath(): string {
	return join(getWebUIPath(), 'index.html');
}

/**
 * Check if web UI assets are available
 */
export function isWebUIAvailable(): boolean {
	// Check embedded assets first
	if (EMBEDDED_ASSETS.size > 0) {
		return true;
	}

	// Check filesystem
	try {
		const fs = require('node:fs');
		return fs.existsSync(getIndexPath());
	} catch {
		return false;
	}
}

export interface ServeWebUIOptions {
	/**
	 * URL prefix for the web UI (default: '/ui')
	 * @example '/ui', '/admin', '/dashboard'
	 */
	prefix?: string;

	/**
	 * Whether to redirect root to prefix (default: false)
	 * @example If true, '/' → '/ui'
	 */
	redirectRoot?: boolean;

	/**
	 * Custom 404 handler
	 */
	onNotFound?: (req: Request) => Response | Promise<Response> | null;

	/**
	 * Override the API base URL the web UI should call.
	 *
	 * Defaults to the current request origin. Provide a string/URL for a static
	 * value or a callback to derive it per request. Relative strings are resolved
	 * against the incoming request URL.
	 */
	apiBaseUrl?: ApiBaseUrlOption;
}

/**
 * Create a request handler for serving the web UI
 *
 * @example
 * ```typescript
 * import { serveWebUI } from '@agi-cli/web-ui';
 *
 * Bun.serve({
 *   port: 3000,
 *   fetch: serveWebUI({ prefix: '/ui' })
 * });
 * ```
 */
export function serveWebUI(options: ServeWebUIOptions = {}) {
	const {
		prefix = '/ui',
		redirectRoot = false,
		onNotFound = null,
		apiBaseUrl,
	} = options;

	const webUIPath = getWebUIPath();
	const useEmbedded = EMBEDDED_ASSETS.size > 0;

	const resolveApiBaseUrl = async (req: Request): Promise<string | null> => {
		let value: string | URL | null | undefined;
		if (typeof apiBaseUrl === 'function') {
			value = await apiBaseUrl({ req });
		} else if (apiBaseUrl !== undefined) {
			value = apiBaseUrl;
		}

		if (value == null) {
			return new URL(req.url).origin;
		}

		if (value instanceof URL) {
			return value.toString();
		}

		const trimmed = value.trim();
		if (!trimmed) return null;

		try {
			if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
				return trimmed;
			}
			return new URL(trimmed, req.url).toString();
		} catch {
			return trimmed;
		}
	};

	const injectIndexHtml = (html: string, baseUrl: string | null) => {
		if (!baseUrl) return html;
		const script = `<script>(function(){var url=${JSON.stringify(
			baseUrl,
		)};window.AGI_SERVER_URL=url;window.__AGI_API_URL__=url;})();</script>`;
		if (html.includes('</head>')) {
			return html.replace('</head>', `${script}\n</head>`);
		}
		if (html.includes('</body>')) {
			return html.replace('</body>', `${script}\n</body>`);
		}
		return `${html}\n${script}`;
	};

	return async function handleRequest(req: Request): Promise<Response | null> {
		const url = new URL(req.url);

		// Helper to serve a file
		const serveAsset = async (pathname: string): Promise<Response | null> => {
			const normalizedPath =
				pathname === '' || pathname === '/' ? '/index.html' : pathname;

			// Try embedded assets first
			if (useEmbedded) {
				const asset = EMBEDDED_ASSETS.get(normalizedPath);
				if (asset) {
					if (normalizedPath === '/index.html') {
						const html = Buffer.from(asset.content, 'base64').toString('utf-8');
						const injected = injectIndexHtml(
							html,
							await resolveApiBaseUrl(req),
						);
						return new Response(injected, {
							headers: { 'Content-Type': 'text/html' },
						});
					}
					const content = Buffer.from(asset.content, 'base64');
					return new Response(content, {
						headers: { 'Content-Type': asset.contentType },
					});
				}
			}

			// Fallback to filesystem
			const fullPath = join(webUIPath, normalizedPath);

			// Security: Prevent directory traversal
			if (!fullPath.startsWith(webUIPath)) {
				return null;
			}

			try {
				if (typeof Bun !== 'undefined') {
					const file = Bun.file(fullPath);
					if (await file.exists()) {
						if (normalizedPath === '/index.html') {
							const html = await file.text();
							const injected = injectIndexHtml(
								html,
								await resolveApiBaseUrl(req),
							);
							return new Response(injected, {
								headers: { 'Content-Type': 'text/html' },
							});
						}
						return new Response(file);
					}
				} else {
					// Fallback for Node.js environments
					const fs = require('node:fs');
					const fsPromises = require('node:fs/promises');
					if (fs.existsSync(fullPath)) {
						if (normalizedPath === '/index.html') {
							const html = await fsPromises.readFile(fullPath, 'utf8');
							const injected = injectIndexHtml(
								html,
								await resolveApiBaseUrl(req),
							);
							return new Response(injected, {
								headers: { 'Content-Type': 'text/html' },
							});
						}
						const content = await fsPromises.readFile(fullPath);
						const ext = fullPath.split('.').pop() || '';
						const contentType = getContentType(ext);
						return new Response(content, {
							headers: { 'Content-Type': contentType },
						});
					}
				}
			} catch (err) {
				console.error('Error serving asset:', err);
				return null;
			}

			return null;
		};

		// Root redirect (optional)
		if (redirectRoot && url.pathname === '/') {
			return new Response('', {
				status: 302,
				headers: { Location: prefix },
			});
		}

		// Handle prefixed paths (e.g., /ui/*)
		if (url.pathname.startsWith(prefix)) {
			// Strip prefix to get the actual file path
			const filePath = url.pathname.slice(prefix.length);

			// Try to serve the requested file
			const assetResponse = await serveAsset(filePath);
			if (assetResponse) {
				return assetResponse;
			}

			// SPA fallback - serve index.html for unmatched routes
			const indexResponse = await serveAsset('/index.html');
			if (indexResponse) {
				return indexResponse;
			}

			// Web UI not found
			if (onNotFound) {
				return onNotFound(req);
			}

			return new Response('Web UI not found', { status: 404 });
		}

		// Handle direct asset requests (for cases where HTML references /assets/*)
		if (
			url.pathname.startsWith('/assets/') ||
			url.pathname === '/vite.svg' ||
			url.pathname === '/favicon.ico'
		) {
			const directAsset = await serveAsset(url.pathname);
			if (directAsset) {
				return directAsset;
			}
		}

		// Not a web UI request - return null so other handlers can process it
		return null;
	};
}

/**
 * Get MIME type for file extension
 */
function getContentType(ext: string): string {
	const types: Record<string, string> = {
		html: 'text/html',
		css: 'text/css',
		js: 'application/javascript',
		json: 'application/json',
		png: 'image/png',
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		gif: 'image/gif',
		svg: 'image/svg+xml',
		ico: 'image/x-icon',
		woff: 'font/woff',
		woff2: 'font/woff2',
		ttf: 'font/ttf',
		eot: 'application/vnd.ms-fontobject',
	};
	return types[ext.toLowerCase()] || 'application/octet-stream';
}
