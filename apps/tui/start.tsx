import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import treeSitterWorkerPath from '../../node_modules/@opentui/core/parser.worker.js' with {
	type: 'file',
};
import { App } from './src/App.tsx';
import { ThemeProvider } from './src/theme.ts';
import { setPort, configureApi } from './src/api.ts';

export async function startTui(
	port: number,
	stopServer?: () => Promise<void>,
): Promise<void> {
	setPort(port);
	configureApi();
	if (!process.env.OTUI_TREE_SITTER_WORKER_PATH) {
		process.env.OTUI_TREE_SITTER_WORKER_PATH = treeSitterWorkerPath;
	}

	const renderer = await createCliRenderer({
		exitOnCtrlC: false,
		useAlternateScreen: true,
		targetFps: 30,
	});

	let exiting = false;

	async function gracefulExit(code: number) {
		if (exiting) return;
		exiting = true;
		try {
			renderer.destroy();
		} catch {}
		try {
			if (stopServer) await stopServer();
		} catch {}
		setTimeout(() => process.exit(code), 100);
	}

	process.on('uncaughtException', (error) => {
		renderer.destroy();
		console.error('Uncaught exception:', error);
		gracefulExit(1);
	});

	process.on('unhandledRejection', (reason) => {
		renderer.destroy();
		console.error('Unhandled rejection:', reason);
		gracefulExit(1);
	});

	process.on('SIGINT', () => gracefulExit(0));
	process.on('SIGTERM', () => gracefulExit(0));

	function handleQuit() {
		gracefulExit(0);
	}

	createRoot(renderer).render(
		<ThemeProvider>
			<App onQuit={handleQuit} />
		</ThemeProvider>,
	);

	await new Promise(() => {});
}
