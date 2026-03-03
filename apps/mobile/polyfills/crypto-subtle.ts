import * as ExpoCrypto from 'expo-crypto';

// Provide a minimal `crypto.subtle.digest` for environments where WebCrypto is absent.
const globalCrypto: any = globalThis.crypto ?? {};
globalCrypto.subtle = globalCrypto.subtle ?? {};

if (typeof globalCrypto.subtle.digest !== 'function') {
	globalCrypto.subtle.digest = async (algorithm: any, data: BufferSource) => {
		const algoName =
			typeof algorithm === 'string' ? algorithm : algorithm?.name;
		const input =
			data instanceof Uint8Array
				? data
				: ArrayBuffer.isView(data)
					? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
					: data instanceof ArrayBuffer
						? new Uint8Array(data)
						: new Uint8Array(data as ArrayBuffer);
		return ExpoCrypto.digest(algoName as any, input);
	};
}

// Keep any existing crypto methods (e.g., from react-native-get-random-values).
globalThis.crypto = globalCrypto;
