import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { App } from './src/App.tsx';
import { ThemeProvider } from './src/theme.ts';
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
		setTimeout(() => process.exit(1), 50);
	});

	process.on('unhandledRejection', (reason) => {
		renderer.destroy();
		console.error('Unhandled rejection:', reason);
		setTimeout(() => process.exit(1), 50);
	});

	function handleQuit() {
		renderer.destroy();
		setTimeout(() => process.exit(0), 50);
	}

	createRoot(renderer).render(
		<ThemeProvider>
			<App onQuit={handleQuit} />
		</ThemeProvider>,
	);

	await new Promise(() => {});
}
