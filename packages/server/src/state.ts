/**
 * Server state - tracks runtime information like the server's port
 * This is the single source of truth for server configuration
 */

let serverPort: number | null = null;

export function setServerPort(port: number): void {
	serverPort = port;
}

export function getServerPort(): number | null {
	return serverPort;
}

export function getServerInfo(): { port: number | null } {
	return { port: serverPort };
}
