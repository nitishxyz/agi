declare module '*.sql' {
	const content: string;
	export default content;
}

declare module '*.dylib' {
	const path: string;
	export default path;
}

declare module '*.so' {
	const path: string;
	export default path;
}

declare module '*.dll' {
	const path: string;
	export default path;
}

declare module 'qrcode-terminal' {
	type QRCodeCallback = (qr: string) => void;

	const qrcode: {
		generate(data: string, callback: QRCodeCallback): void;
		generate(
			data: string,
			options: { small?: boolean },
			callback: QRCodeCallback,
		): void;
	};

	export default qrcode;
}
