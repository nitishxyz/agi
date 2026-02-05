import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Embedded assets map - populated at build time
const EMBEDDED_ASSETS = new Map<
	string,
	{ content: string; contentType: string }
>();

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
	 * API server URL for the web UI to connect to
	 * If not provided, will attempt to auto-detect from the request
	 * or fall back to localhost:9100
	 * @example 'http://localhost:3000', 'https://api.example.com'
	 */
	serverUrl?: string;
}

/**
 * Create a request handler for serving the web UI
 *
 * @example
 * ```typescript
 * import { serveWebUI } from '@ottocode/web-ui';
 *
 * Bun.serve({
 *   port: 3000,
 *   fetch: serveWebUI({ prefix: '/ui' })
 * });
 * ```
 */
function normalizeBasePath(prefix: string): string {
	const trimmed = prefix.trim();
	if (!trimmed || trimmed === '/') {
		return '/';
	}
	const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
	const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, '');
	return withoutTrailingSlash || '/';
}

function injectRuntimeConfig(
	html: string,
	serverUrl: string,
	basePath: string,
): string {
	const runtimeScript = `<!-- otto server URL: ${serverUrl} --><script>window.OTTO_SERVER_URL = ${JSON.stringify(serverUrl)};window.OTTO_ROUTER_BASEPATH = ${JSON.stringify(basePath)};</script>`;
	return html.replace('</head>', `${runtimeScript}</head>`);
}

export function serveWebUI(options: ServeWebUIOptions = {}) {
	const {
		prefix = '/ui',
		redirectRoot = false,
		onNotFound = null,
		serverUrl,
	} = options;

	const webUIPath = getWebUIPath();
	const useEmbedded = EMBEDDED_ASSETS.size > 0;
	const basePath = normalizeBasePath(prefix);

	return async function handleRequest(req: Request): Promise<Response | null> {
		const url = new URL(req.url);

		// Determine the server URL for this request
		let resolvedServerUrl: string;
		if (serverUrl) {
			resolvedServerUrl = serverUrl;
		} else {
			// Auto-detect from the request URL (protocol + host)
			// This ensures the web UI connects to the same host it was loaded from
			const baseUrl = `${url.protocol}//${url.host}`;
			resolvedServerUrl = baseUrl;
		}

		// Helper to serve a file
		const serveAsset = async (pathname: string): Promise<Response | null> => {
			const normalizedPath =
				pathname === '' || pathname === '/' ? '/index.html' : pathname;

			// Try embedded assets first
			if (useEmbedded) {
				const asset = EMBEDDED_ASSETS.get(normalizedPath);
				if (asset) {
					let content = Buffer.from(asset.content, 'base64');

					// Inject server URL into index.html
					if (normalizedPath === '/index.html') {
						const html = content.toString('utf-8');
						const injectedHtml = injectRuntimeConfig(
							html,
							resolvedServerUrl,
							basePath,
						);
						content = Buffer.from(injectedHtml, 'utf-8');
					}

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
						// Inject server URL into index.html
						if (normalizedPath === '/index.html') {
							const html = await file.text();
							const injectedHtml = injectRuntimeConfig(
								html,
								resolvedServerUrl,
								basePath,
							);
							return new Response(injectedHtml, {
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
						let content = await fsPromises.readFile(fullPath);
						const ext = fullPath.split('.').pop() || '';
						const contentType = getContentType(ext);

						// Inject server URL into index.html
						if (normalizedPath === '/index.html') {
							const html = content.toString('utf-8');
							const injectedHtml = injectRuntimeConfig(
								html,
								resolvedServerUrl,
								basePath,
							);
							content = Buffer.from(injectedHtml, 'utf-8');
						}

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
			url.pathname === '/favicon.svg' ||
			url.pathname === '/favicon.ico' ||
			url.pathname === '/vite.svg'
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

export default {
	getWebUIPath,
	getIndexPath,
	isWebUIAvailable,
	serveWebUI,
};
