declare module 'qrcode-terminal' {
	interface Options {
		small?: boolean;
	}

	function generate(
		text: string,
		opts?: Options,
		callback?: (qrcode: string) => void,
	): void;

	function setErrorLevel(level: 'L' | 'M' | 'Q' | 'H'): void;

	export { generate, setErrorLevel };
	export default { generate, setErrorLevel };
}
