declare module '*.dylib' {
	const filePath: string;
	export default filePath;
}

declare module '*.so' {
	const filePath: string;
	export default filePath;
}

declare module '*.dll' {
	const filePath: string;
	export default filePath;
}
