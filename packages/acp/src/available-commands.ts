import type {
	AgentSideConnection,
	AvailableCommand,
} from '@agentclientprotocol/sdk';
import { listAvailableSlashCommands } from '@ottocode/server/runtime/commands/available';

export function queueAvailableCommands(
	client: AgentSideConnection,
	sessionId: string,
): void {
	for (const delayMs of [0, 250]) {
		setTimeout(() => {
			void sendAvailableCommands(client, sessionId).catch((err) => {
				console.error('[acp] Failed to send available commands:', err);
			});
		}, delayMs);
	}
}

async function sendAvailableCommands(
	client: AgentSideConnection,
	sessionId: string,
): Promise<void> {
	const availableCommands: AvailableCommand[] = [
		...listAvailableSlashCommands().map((command) => ({
			name: command.name,
			description: command.description,
			...(command.input ? { input: command.input } : {}),
		})),
		{
			name: 'mcp',
			description: 'List, start, stop, and inspect MCP servers',
			input: { hint: 'list | status | start <name> | stop <name>' },
		},
		{
			name: 'stage',
			description: 'Stage all changes or specific paths',
			input: { hint: '[path ...]' },
		},
		{
			name: 'reasoning',
			description: 'Show or set reasoning and effort level',
			input: { hint: 'on | off | set <effort>' },
		},
	];

	await client.sessionUpdate({
		sessionId,
		update: {
			sessionUpdate: 'available_commands_update',
			availableCommands,
		},
	});
}
