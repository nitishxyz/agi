export function isDebugEnabled(): boolean {
	const v = String(process.env.DEBUG_AGI ?? '')
		.trim()
		.toLowerCase();
	if (!v) return false;
	return (
		v === '1' ||
		v === 'true' ||
		v === 'yes' ||
		v === 'on' ||
		v === 'debug' ||
		v === 'verbose' ||
		v === 'all' ||
		!!v
	);
}

export function debugLog(...args: unknown[]) {
	if (!isDebugEnabled()) return;
	try {
		console.log('[debug]', ...args);
	} catch {}
}
