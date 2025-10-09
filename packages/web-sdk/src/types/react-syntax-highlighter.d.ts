import type { ComponentType, CSSProperties } from 'react';

declare module 'react-syntax-highlighter' {
	export interface SyntaxHighlighterProps {
		language?: string;
		// biome-ignore lint/suspicious/noExplicitAny: External library type definition
		style?: any;
		// biome-ignore lint/suspicious/noExplicitAny: External library type definition - accepts React component
		PreTag?: string | ComponentType<any>;
		customStyle?: CSSProperties;
		// biome-ignore lint/suspicious/noExplicitAny: External library type definition
		codeTagProps?: any;
		wrapLongLines?: boolean;
		// biome-ignore lint/suspicious/noExplicitAny: External library type definition - allows flexible props
		[key: string]: any;
	}
	const SyntaxHighlighter: ComponentType<SyntaxHighlighterProps>;
	export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
	// biome-ignore lint/suspicious/noExplicitAny: External library constant - theme object
	export const vscDarkPlus: any;
	// biome-ignore lint/suspicious/noExplicitAny: External library constant - theme object
	export const oneLight: any;
}
