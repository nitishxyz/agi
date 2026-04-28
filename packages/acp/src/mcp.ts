import type { NewSessionRequest } from '@agentclientprotocol/sdk';
import type { MCPServerConfig } from '@ottocode/sdk';

export function acpMcpServersToOttoConfig(
	servers: NonNullable<NewSessionRequest['mcpServers']>,
): MCPServerConfig[] {
	return servers.map((server) => {
		if ('type' in server && (server.type === 'http' || server.type === 'sse')) {
			return {
				name: server.name,
				transport: server.type,
				url: server.url,
				headers: Object.fromEntries(
					server.headers.map((header) => [header.name, header.value]),
				),
				scope: 'project',
			};
		}

		return {
			name: server.name,
			transport: 'stdio',
			command: server.command,
			args: server.args,
			env: Object.fromEntries(server.env.map((env) => [env.name, env.value])),
			scope: 'project',
		};
	});
}
