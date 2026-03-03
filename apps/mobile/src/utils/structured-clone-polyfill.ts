// Attach the polyfill as a Global function
import structuredClone from '@ungap/structured-clone';
if (globalThis.structuredClone === undefined) {
	// @ts-expect-error
	globalThis.structuredClone = structuredClone;
}
