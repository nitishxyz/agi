// Must be imported before any Solana dependencies to suppress bigint-buffer warning
const originalWarn = console.warn;
console.warn = (...args: unknown[]) => {
	const msg = args[0];
	if (typeof msg === 'string' && msg.includes('bigint: Failed to load bindings')) {
		return;
	}
	originalWarn.apply(console, args);
};
