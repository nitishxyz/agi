export interface ThemeColors {
	bg: string;
	bgDark: string;
	bgHighlight: string;
	bgSubtle: string;

	fg: string;
	fgBright: string;
	fgMuted: string;
	fgDark: string;
	fgDimmed: string;

	blue: string;
	green: string;
	red: string;
	yellow: string;
	purple: string;
	cyan: string;
	orange: string;
	teal: string;
	magenta: string;

	border: string;
	borderActive: string;
	borderSubtle: string;

	toolBg: string;
	toolFg: string;
	toolIcon: string;
	toolName: string;
	toolArgs: string;

	userBg: string;
	assistantBg: string;

	userBadge: string;
	assistantBadge: string;
	systemBadge: string;

	streamDot: string;
	errorBg: string;
}

export interface ThemeSyntax {
	keyword: string;
	keywordImport: string;
	keywordOperator: string;
	string: string;
	comment: string;
	number: string;
	boolean: string;
	constant: string;
	function: string;
	functionCall: string;
	functionMethodCall: string;
	type: string;
	constructor: string;
	variable: string;
	variableMember: string;
	property: string;
	operator: string;
	punctuation: string;
	punctuationBracket: string;
	punctuationDelimiter: string;
	default: string;
	markupHeading: string;
	markupHeading1: string;
	markupHeading2: string;
	markupBold: string;
	markupStrong: string;
	markupItalic: string;
	markupList: string;
	markupQuote: string;
	markupRaw: string;
	markupRawBlock: string;
	markupLink: string;
	markupLinkUrl: string;
}

export interface Theme {
	name: string;
	displayName: string;
	colors: ThemeColors;
	syntax: ThemeSyntax;
}
