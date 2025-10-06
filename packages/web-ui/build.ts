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

console.log('🏗️  Building @agi-cli/web-ui package...\n');

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

// Populate embedded assets
${embeddedAssetsCode}

async function resolveApiBaseUrl(option, req) {
  let value;
  if (typeof option === 'function') {
    value = await option({ req });
  } else if (option !== undefined) {
    value = option;
  } else {
    value = null;
  }

  if (value === null || value === undefined) {
    return new URL(req.url).origin;
  }

  if (value instanceof URL) {
    return value.toString();
  }

  const str = String(value).trim();
  if (!str) return null;

  try {
    if (str.startsWith('http://') || str.startsWith('https://')) {
      return str;
    }
    return new URL(str, req.url).toString();
  } catch {
    return str;
  }
}

function injectIndexHtml(html, baseUrl) {
  if (!baseUrl) return html;
  const script = '<script>(function(){var url=' + JSON.stringify(baseUrl) + ';window.AGI_SERVER_URL=url;window.__AGI_API_URL__=url;})();</script>';
  if (html.includes('</head>')) {
    return html.replace('</head>', script + '\\n</head>');
  }
  if (html.includes('</body>')) {
    return html.replace('</body>', script + '\\n</body>');
  }
  return html + '\\n' + script;
}

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
  if (EMBEDDED_ASSETS.size > 0) {
    return true;
  }

  try {
    const fs = require('fs');
    return fs.existsSync(getIndexPath());
  } catch {
    return false;
  }
}

export function serveWebUI(options = {}) {
  const {
    prefix = '/ui',
    redirectRoot = false,
    onNotFound = null,
    apiBaseUrl,
  } = options;

  const webUIPath = getWebUIPath();
  const useEmbedded = EMBEDDED_ASSETS.size > 0;

  return async function handleRequest(req) {
    const url = new URL(req.url);
    const baseUrlPromise = resolveApiBaseUrl(apiBaseUrl, req);

    const serveAsset = async (pathname) => {
      const normalizedPath = pathname === '' || pathname === '/' ? '/index.html' : pathname;
      const shouldInject = normalizedPath === '/index.html';
      const resolvedBaseUrl = shouldInject ? await baseUrlPromise : null;

      if (useEmbedded) {
        const asset = EMBEDDED_ASSETS.get(normalizedPath);
        if (asset) {
          if (shouldInject) {
            const html = Buffer.from(asset.content, 'base64').toString('utf-8');
            const injected = injectIndexHtml(html, resolvedBaseUrl);
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

      const fullPath = join(webUIPath, normalizedPath);
      if (!fullPath.startsWith(webUIPath)) {
        return null;
      }

      try {
        if (typeof Bun !== 'undefined') {
          const file = Bun.file(fullPath);
          if (await file.exists()) {
            if (shouldInject) {
              const html = await file.text();
              const injected = injectIndexHtml(html, resolvedBaseUrl);
              return new Response(injected, {
                headers: { 'Content-Type': 'text/html' },
              });
            }
            return new Response(file);
          }
        } else {
          const fs = require('fs');
          const fsPromises = require('fs/promises');
          if (fs.existsSync(fullPath)) {
            if (shouldInject) {
              const html = await fsPromises.readFile(fullPath, 'utf8');
              const injected = injectIndexHtml(html, resolvedBaseUrl);
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

    if (redirectRoot && url.pathname === '/') {
      return new Response('', {
        status: 302,
        headers: { Location: prefix },
      });
    }

    if (url.pathname.startsWith(prefix)) {
      const filePath = url.pathname.slice(prefix.length);
      const assetResponse = await serveAsset(filePath);
      if (assetResponse) {
        return assetResponse;
      }

      const indexResponse = await serveAsset('/index.html');
      if (indexResponse) {
        return indexResponse;
      }

      if (onNotFound) {
        return onNotFound(req);
      }

      return new Response('Web UI not found', { status: 404 });
    }

    if (url.pathname.startsWith('/assets/') ||
        url.pathname === '/vite.svg' ||
        url.pathname === '/favicon.ico') {
      const directAsset = await serveAsset(url.pathname);
      if (directAsset) {
        return directAsset;
      }
    }

    return null;
  };
}

function getContentType(ext) {
  const types = {
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
