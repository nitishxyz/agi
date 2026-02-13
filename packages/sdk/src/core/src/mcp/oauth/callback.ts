import { createServer, type Server } from 'node:http';

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff">
<div style="text-align:center">
<h1>Authorized</h1>
<p>You can close this window and return to ottocode.</p>
<script>setTimeout(()=>window.close(),2000)</script>
</div>
</body>
</html>`;

export interface CallbackResult {
	code: string;
	state?: string;
}

export class OAuthCallbackServer {
	private server: Server | null = null;
	private port: number;

	constructor(port: number) {
		this.port = port;
	}

	waitForCallback(timeoutMs = 300000): Promise<CallbackResult> {
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.close();
				reject(new Error('OAuth callback timed out'));
			}, timeoutMs);

			this.server = createServer((req, res) => {
				if (!req.url || req.url === '/favicon.ico') {
					res.writeHead(404);
					res.end();
					return;
				}

				const parsed = new URL(req.url, `http://localhost:${this.port}`);
				const code = parsed.searchParams.get('code');
				const error = parsed.searchParams.get('error');
				const state = parsed.searchParams.get('state');

				if (error) {
					res.writeHead(400, { 'Content-Type': 'text/html' });
					res.end(`<h1>Authorization failed: ${error}</h1>`);
					clearTimeout(timer);
					this.close();
					reject(new Error(`OAuth error: ${error}`));
					return;
				}

				if (code) {
					res.writeHead(200, { 'Content-Type': 'text/html' });
					res.end(SUCCESS_HTML);
					clearTimeout(timer);
					this.close();
					resolve({ code, state: state ?? undefined });
					return;
				}

				res.writeHead(400, { 'Content-Type': 'text/plain' });
				res.end('Missing authorization code');
			});

			this.server.listen(this.port, '127.0.0.1', () => {});

			this.server.on('error', (err) => {
				clearTimeout(timer);
				reject(err);
			});
		});
	}

	close(): void {
		if (this.server) {
			this.server.close();
			this.server = null;
		}
	}
}
