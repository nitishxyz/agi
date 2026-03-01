import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './src/App.tsx';
import { setPort, configureApi } from './src/api.ts';

export async function startTui(port: number): Promise<void> {
	setPort(port);
	configureApi();

	const renderer = await createCliRenderer({
		exitOnCtrlC: false,
		useAlternateScreen: true,
		targetFps: 30,
	});

	process.on('uncaughtException', (error) => {
		renderer.destroy();
		console.error('Uncaught exception:', error);
		process.exit(1);
	});

	process.on('unhandledRejection', (reason) => {
		renderer.destroy();
		console.error('Unhandled rejection:', reason);
		process.exit(1);
	});

	function handleQuit() {
		renderer.destroy();
		process.exit(0);
	}

	createRoot(renderer).render(<App onQuit={handleQuit} />);

	await new Promise(() => {});
}
