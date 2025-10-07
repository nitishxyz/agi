/**
 * Embedded Web UI Server
 * Serves the web UI from embedded assets
 */

import type { Server } from 'bun';
import { webAssetPaths, assetPaths, getEmbeddedAsset } from './web-assets';

const decoder = new TextDecoder();

// MIME types
const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
};

function getMimeType(path: string): string {
	const ext = path.substring(path.lastIndexOf('.'));
	return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Create the web UI server
 */
export function createWebServer(
	port: number,
	agiServerPort: number,
	network = false,
): { port: number; server: Server } {
	// Build asset map - maps URL paths to file paths
	const assetMap = new Map<string, string>();

	// Map root and index.html to the HTML file
	assetMap.set('/', webAssetPaths.html);
	assetMap.set('/index.html', webAssetPaths.html);

	// Map JS files
	assetPaths.assets.js.forEach((urlPath, index) => {
		assetMap.set(urlPath, webAssetPaths.js[index]);
	});

	// Map CSS files
	assetPaths.assets.css.forEach((urlPath, index) => {
		assetMap.set(urlPath, webAssetPaths.css[index]);
	});

	// Map other assets
	assetPaths.assets.other.forEach((urlPath, index) => {
		assetMap.set(urlPath, webAssetPaths.other[index]);
	});

	// Get the appropriate server URL for network mode
	const getServerUrl = (requestHost?: string) => {
		if (network && requestHost) {
			// Extract hostname from request (e.g., "192.168.1.100:3457" -> "192.168.1.100")
			const hostname = requestHost.split(':')[0];
			return `http://${hostname}:${agiServerPort}`;
		}
		return `http://localhost:${agiServerPort}`;
	};

	const server = Bun.serve({
		port,
		hostname: network ? '0.0.0.0' : 'localhost',

		async fetch(req) {
			const url = new URL(req.url);
			let pathname = url.pathname;

			// Normalize path
			if (pathname === '/') {
				pathname = '/index.html';
			}

			// Check if we have this asset
			if (assetMap.has(pathname)) {
				const filePath = assetMap.get(pathname);
				if (!filePath) {
					return new Response('Not Found', { status: 404 });
				}

				const file = Bun.file(filePath);
				const fileExists = await file.exists();

				if (fileExists) {
					if (pathname.endsWith('.html')) {
						try {
							let html = await file.text();
							const serverUrl = getServerUrl(url.host);
							const scriptTag = `<script>window.AGI_SERVER_URL = '${serverUrl}';</script>`;
							html = html.replace('</head>', `${scriptTag}</head>`);

							return new Response(html, {
								headers: {
									'Content-Type': 'text/html; charset=utf-8',
									'Cache-Control': 'no-cache',
								},
							});
						} catch (error) {
							console.error('Error reading HTML file:', error);
						}
					}

					return new Response(file, {
						headers: {
							'Content-Type': getMimeType(pathname),
							'Cache-Control': 'public, max-age=31536000',
						},
					});
				}

				const embeddedData = getEmbeddedAsset(pathname);
				if (embeddedData) {
					if (pathname.endsWith('.html')) {
						let html = decoder.decode(embeddedData);
						const serverUrl = getServerUrl(url.host);
						const scriptTag = `<script>window.AGI_SERVER_URL = '${serverUrl}';</script>`;
						html = html.replace('</head>', `${scriptTag}</head>`);

						return new Response(html, {
							headers: {
								'Content-Type': 'text/html; charset=utf-8',
								'Cache-Control': 'no-cache',
							},
						});
					}

					return new Response(embeddedData, {
						headers: {
							'Content-Type': getMimeType(pathname),
							'Cache-Control': 'public, max-age=31536000',
						},
					});
				}
			}

			console.warn(`File not found: ${pathname}`);
			return new Response('Not Found', { status: 404 });
		},
	});

	return { port: server.port, server };
}
