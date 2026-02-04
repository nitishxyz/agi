#!/usr/bin/env bun
import {
	cpSync,
	existsSync,
	mkdirSync,
	rmSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from 'node:fs';
import { join, extname } from 'node:path';

console.log('🏗️  Building @ottocode/web-ui package...\n');

// Paths
const webAppDir = join(import.meta.dir, '../../apps/web');
const webAppDistDir = join(webAppDir, 'dist');
const packageDistDir = join(import.meta.dir, 'dist');
const webAssetsDir = join(packageDistDir, 'web-assets');

// Step 1: Build the web app
console.log('📦 Building web app...');
const buildWeb = Bun.spawnSync(['bun', 'run', 'build'], {
	cwd: webAppDir,
	stdout: 'inherit',
	stderr: 'inherit',
});

if (!buildWeb.success) {
	console.error('❌ Failed to build web app');
	process.exit(1);
}

// Step 2: Ensure dist directory exists
if (!existsSync(packageDistDir)) {
	mkdirSync(packageDistDir, { recursive: true });
}

// Step 3: Clean and copy web assets
console.log('📋 Copying web assets...');
if (existsSync(webAssetsDir)) {
	rmSync(webAssetsDir, { recursive: true, force: true });
}

if (!existsSync(webAppDistDir)) {
	console.error('❌ Web app dist directory not found');
	process.exit(1);
}

cpSync(webAppDistDir, webAssetsDir, { recursive: true });

// Step 4: Read and encode assets for embedding
console.log('🔐 Encoding assets for embedding...');

function getContentType(ext: string): string {
	const types: Record<string, string> = {
		'.html': 'text/html',
		'.css': 'text/css',
		'.js': 'application/javascript',
		'.json': 'application/json',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.svg': 'image/svg+xml',
		'.ico': 'image/x-icon',
		'.woff': 'font/woff',
		'.woff2': 'font/woff2',
		'.ttf': 'font/ttf',
		'.eot': 'application/vnd.ms-fontobject',
	};
	return types[ext.toLowerCase()] || 'application/octet-stream';
}

function readAssetsRecursively(
	dir: string,
	baseDir: string = dir,
): Array<{ path: string; content: string; contentType: string }> {
	const assets: Array<{ path: string; content: string; contentType: string }> =
		[];
	const entries = readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			assets.push(...readAssetsRecursively(fullPath, baseDir));
		} else {
			const relativePath = `/${fullPath.slice(baseDir.length + 1).replace(/\\/g, '/')}`;
			const content = readFileSync(fullPath).toString('base64');
			const contentType = getContentType(extname(entry.name));

			assets.push({
				path: relativePath,
				content,
				contentType,
			});
		}
	}

	return assets;
}

const assets = readAssetsRecursively(webAssetsDir);
console.log(`   Found ${assets.length} assets`);

// Step 5: Generate index.js with embedded assets
console.log('📝 Generating index.js with embedded assets...');

const embeddedAssetsCode = assets
	.map(
		(asset) =>
			`EMBEDDED_ASSETS.set(${JSON.stringify(asset.path)}, { content: ${JSON.stringify(asset.content)}, contentType: ${JSON.stringify(asset.contentType)} });`,
	)
	.join('\n');

const indexJsTemplate = `import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Embedded assets map - populated at build time
const EMBEDDED_ASSETS = new Map();

function normalizeBasePath(prefix) {
  const trimmed = prefix.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : \`/\${trimmed}\`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\\/+$/, '');
  return withoutTrailingSlash || '/';
}

function injectRuntimeConfig(html, serverUrl, basePath) {
  const runtimeScript = \`<!-- otto server URL: \${serverUrl} --><script>window.OTTO_SERVER_URL = \${JSON.stringify(serverUrl)};window.OTTO_ROUTER_BASEPATH = \${JSON.stringify(basePath)};</script>\`;
  return html.replace('</head>', \`\${runtimeScript}</head>\`);
}

// Populate embedded assets
${embeddedAssetsCode}

/**
 * Get the absolute path to the web UI assets directory
 */
export function getWebUIPath() {
  return join(__dirname, 'web-assets');
}

/**
 * Get the absolute path to the index.html file
 */
export function getIndexPath() {
  return join(getWebUIPath(), 'index.html');
}

/**
 * Check if web UI assets are available
 */
export function isWebUIAvailable() {
  // Check embedded assets first
  if (EMBEDDED_ASSETS.size > 0) {
    return true;
  }
  
  // Check filesystem
  try {
    const fs = require('fs');
    return fs.existsSync(getIndexPath());
  } catch {
    return false;
  }
}

/**
 * Create a request handler for serving the web UI
 */
export function serveWebUI(options = {}) {
  const {
    prefix = '/ui',
    redirectRoot = false,
    onNotFound = null,
    serverUrl,
  } = options;

  const webUIPath = getWebUIPath();
  const useEmbedded = EMBEDDED_ASSETS.size > 0;
  const basePath = normalizeBasePath(prefix);

  return async function handleRequest(req) {
    const url = new URL(req.url);

    // Determine the server URL for this request
    let resolvedServerUrl;
    if (serverUrl) {
      resolvedServerUrl = serverUrl;
    } else {
      // Auto-detect from the request URL (protocol + host)
      const baseUrl = \`\${url.protocol}//\${url.host}\`;
      resolvedServerUrl = baseUrl;
    }

    // Helper to serve a file
    const serveAsset = async (pathname) => {
      const normalizedPath = pathname === '' || pathname === '/' ? '/index.html' : pathname;
      
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
          const fs = require('fs');
          const fsPromises = require('fs/promises');
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
    if (url.pathname.startsWith('/assets/') || 
        url.pathname === '/vite.svg' || 
        url.pathname === '/favicon.ico') {
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
function getContentType(ext) {
  const types = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
}

export default {
  getWebUIPath,
  getIndexPath,
  isWebUIAvailable,
  serveWebUI,
};
`;

writeFileSync(join(packageDistDir, 'index.js'), indexJsTemplate);

// Step 6: Generate type declarations
console.log('📝 Generating type declarations...');
const buildTypes = Bun.spawnSync(['bunx', 'tsc', '--emitDeclarationOnly'], {
	cwd: import.meta.dir,
	stdout: 'inherit',
	stderr: 'inherit',
});

if (!buildTypes.success) {
	console.error('❌ Failed to generate type declarations');
	process.exit(1);
}

console.log('\n✅ Build complete!');
console.log(`   Web assets: ${webAssetsDir}`);
console.log(`   Package: ${packageDistDir}`);
console.log(`   Embedded: ${assets.length} assets`);
