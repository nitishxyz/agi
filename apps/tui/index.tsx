import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import 'opentui-spinner/react';
import { App } from './src/App.tsx';
import { ThemeProvider } from './src/theme.ts';
import { configureApi } from './src/api.ts';

configureApi();

const renderer = await createCliRenderer({
	exitOnCtrlC: false,
	useAlternateScreen: true,
	targetFps: 30,
});

let exiting = false;

function gracefulExit(code: number) {
	if (exiting) return;
	exiting = true;
	try {
		renderer.destroy();
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
