import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { ensureTunnelBinary } from './binary.ts';

export interface TunnelConnection {
	id: string;
	ip: string;
	location: string;
}

export interface TunnelEvents {
	url: (url: string) => void;
	connected: (connection: TunnelConnection) => void;
	disconnected: (connection: TunnelConnection) => void;
	error: (error: Error) => void;
	exit: (code: number | null, signal: NodeJS.Signals | null) => void;
	stdout: (data: string) => void;
	stderr: (data: string) => void;
}

const URL_REGEX = /https:\/\/([a-z0-9-]+)\.trycloudflare\.com/;
const CONN_REGEX = /Connection ([a-f0-9-]+)/;
const IP_REGEX = /(\d+\.\d+\.\d+\.\d+)/;
const LOCATION_REGEX = /location=([a-z0-9]+)/i;
const INDEX_REGEX = /connIndex=(\d+)/;

const RATE_LIMIT_REGEX = /429 Too Many Requests|error code: 1015/i;
const FAILED_UNMARSHAL_REGEX = /failed to unmarshal quick Tunnel/i;

export class OttoTunnel extends EventEmitter {
	private process: ChildProcess | null = null;
	private connections: (TunnelConnection | undefined)[] = [];
	private _url: string | null = null;
	private _stopped = false;

	get url(): string | null {
		return this._url;
	}

	get isRunning(): boolean {
		return this.process !== null && !this._stopped;
	}

	private handleOutput(output: string): void {
		const urlMatch = output.match(URL_REGEX);
		if (urlMatch && !this._url) {
			this._url = urlMatch[0];
			this.emit('url', this._url);
		}

		const connMatch = output.match(CONN_REGEX);
		const ipMatch = output.match(IP_REGEX);
		const locationMatch = output.match(LOCATION_REGEX);
		const indexMatch = output.match(INDEX_REGEX);

		if (connMatch && ipMatch && locationMatch && indexMatch) {
			const connection: TunnelConnection = {
				id: connMatch[1],
				ip: ipMatch[1],
				location: locationMatch[1],
			};
			const index = Number(indexMatch[1]);
			this.connections[index] = connection;
			this.emit('connected', connection);
		}

		if (output.includes('terminated') && indexMatch) {
			const index = Number(indexMatch[1]);
			const conn = this.connections[index];
			if (conn) {
				this.emit('disconnected', conn);
				this.connections[index] = undefined;
			}
		}
	}

	private checkForRateLimit(output: string): boolean {
		if (RATE_LIMIT_REGEX.test(output) || FAILED_UNMARSHAL_REGEX.test(output)) {
			const error = new Error('Rate limited by Cloudflare. Please wait 5-10 minutes before trying again.');
			(error as any).code = 'RATE_LIMITED';
			this.emit('error', error);
			return true;
		}
		return false;
	}

	async start(
		port: number,
		onProgress?: (message: string) => void,
	): Promise<string> {
		if (this.process) {
			throw new Error('Tunnel is already running');
		}

		const binPath = await ensureTunnelBinary(onProgress);

		return new Promise((resolve, reject) => {
			const args = ['tunnel', '--url', `http://localhost:${port}`];

			this.process = spawn(binPath, args, {
				stdio: ['ignore', 'pipe', 'pipe'],
			});

			this.process.on('error', (error) => {
				this.emit('error', error);
				reject(error);
			});

			this.process.on('exit', (code, signal) => {
				this._stopped = true;
				this.process = null;
				this.emit('exit', code, signal);
			});

			this.process.stdout?.on('data', (data: Buffer) => {
				const output = data.toString();
				this.emit('stdout', output);
				if (this.checkForRateLimit(output)) {
					this.stop();
					reject(new Error('Rate limited by Cloudflare. Please wait 5-10 minutes before trying again.'));
					return;
				}
				this.handleOutput(output);
			});

			this.process.stderr?.on('data', (data: Buffer) => {
				const output = data.toString();
				this.emit('stderr', output);
				if (this.checkForRateLimit(output)) {
					this.stop();
					reject(new Error('Rate limited by Cloudflare. Please wait 5-10 minutes before trying again.'));
					return;
				}
				this.handleOutput(output);
			});

			const timeout = setTimeout(() => {
				if (!this._url) {
					this.stop();
					reject(new Error('Tunnel startup timed out'));
				}
			}, 30000);

			this.once('url', (url) => {
				clearTimeout(timeout);
				resolve(url);
			});

			this.once('error', (error) => {
				clearTimeout(timeout);
				reject(error);
			});
		});
	}

	stop(): boolean {
		if (!this.process) {
			return false;
		}

		this._stopped = true;
		const killed = this.process.kill('SIGINT');

		setTimeout(() => {
			if (this.process && !this.process.killed) {
				this.process.kill('SIGKILL');
			}
		}, 5000);

		return killed;
	}

	on<K extends keyof TunnelEvents>(event: K, listener: TunnelEvents[K]): this {
		return super.on(event, listener);
	}

	once<K extends keyof TunnelEvents>(event: K, listener: TunnelEvents[K]): this {
		return super.once(event, listener);
	}

	emit<K extends keyof TunnelEvents>(
		event: K,
		...args: Parameters<TunnelEvents[K]>
	): boolean {
		return super.emit(event, ...args);
	}
}

export async function createTunnel(
	port: number,
	onProgress?: (message: string) => void,
): Promise<{ url: string; tunnel: OttoTunnel }> {
	const tunnel = new OttoTunnel();
	const url = await tunnel.start(port, onProgress);
	return { url, tunnel };
}
