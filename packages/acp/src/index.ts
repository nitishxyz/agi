import { TerminalManager, setTerminalManager } from '@ottocode/sdk';
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk';
import { OttoAcpAgent } from './agent.ts';
import { nodeToWebWritable, nodeToWebReadable } from './utils.ts';

export function runAcp() {
	console.log = console.error;
	console.info = console.error;
	console.warn = console.error;
	console.debug = console.error;

	process.on('unhandledRejection', (reason, promise) => {
		console.error('Unhandled Rejection at:', promise, 'reason:', reason);
	});

	process.on('uncaughtException', (err) => {
		console.error('Uncaught Exception:', err);
	});

	const terminalManager = new TerminalManager();
	setTerminalManager(terminalManager);

	const output = nodeToWebWritable(process.stdout);
	const input = nodeToWebReadable(process.stdin);
	const stream = ndJsonStream(output, input);

	new AgentSideConnection((client) => new OttoAcpAgent(client), stream);

	process.stdin.resume();
}
