declare module 'react-syntax-highlighter' {
	import type { ComponentType } from 'react';
	export interface SyntaxHighlighterProps {
		language?: string;
		style?: any;
		PreTag?: string | ComponentType<any>;
		customStyle?: any;
		codeTagProps?: any;
		wrapLongLines?: boolean;
		[key: string]: any;
	}
	const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>;
	export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
	export const vscDarkPlus: any;
	export const oneLight: any;
}
