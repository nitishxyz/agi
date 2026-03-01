import { SyntaxStyle, RGBA } from '@opentui/core';
import type { ThemeSyntax } from './types.ts';

export function buildSyntaxStyle(syntax: ThemeSyntax): SyntaxStyle {
	return SyntaxStyle.fromStyles({
		keyword: { fg: RGBA.fromHex(syntax.keyword), bold: true },
		'keyword.import': { fg: RGBA.fromHex(syntax.keywordImport), bold: true },
		'keyword.operator': { fg: RGBA.fromHex(syntax.keywordOperator) },
		string: { fg: RGBA.fromHex(syntax.string) },
		comment: { fg: RGBA.fromHex(syntax.comment), italic: true },
		number: { fg: RGBA.fromHex(syntax.number) },
		boolean: { fg: RGBA.fromHex(syntax.boolean) },
		constant: { fg: RGBA.fromHex(syntax.constant) },
		function: { fg: RGBA.fromHex(syntax.function) },
		'function.call': { fg: RGBA.fromHex(syntax.functionCall) },
		'function.method.call': { fg: RGBA.fromHex(syntax.functionMethodCall) },
		type: { fg: RGBA.fromHex(syntax.type) },
		constructor: { fg: RGBA.fromHex(syntax.constructor) },
		variable: { fg: RGBA.fromHex(syntax.variable) },
		'variable.member': { fg: RGBA.fromHex(syntax.variableMember) },
		property: { fg: RGBA.fromHex(syntax.property) },
		operator: { fg: RGBA.fromHex(syntax.operator) },
		punctuation: { fg: RGBA.fromHex(syntax.punctuation) },
		'punctuation.bracket': { fg: RGBA.fromHex(syntax.punctuationBracket) },
		'punctuation.delimiter': { fg: RGBA.fromHex(syntax.punctuationDelimiter) },
		default: { fg: RGBA.fromHex(syntax.default) },
		'markup.heading': { fg: RGBA.fromHex(syntax.markupHeading), bold: true },
		'markup.heading.1': {
			fg: RGBA.fromHex(syntax.markupHeading1),
			bold: true,
			underline: true,
		},
		'markup.heading.2': { fg: RGBA.fromHex(syntax.markupHeading2), bold: true },
		'markup.bold': { fg: RGBA.fromHex(syntax.markupBold), bold: true },
		'markup.strong': { fg: RGBA.fromHex(syntax.markupStrong), bold: true },
		'markup.italic': { fg: RGBA.fromHex(syntax.markupItalic), italic: true },
		'markup.list': { fg: RGBA.fromHex(syntax.markupList) },
		'markup.quote': { fg: RGBA.fromHex(syntax.markupQuote), italic: true },
		'markup.raw': { fg: RGBA.fromHex(syntax.markupRaw) },
		'markup.raw.block': { fg: RGBA.fromHex(syntax.markupRawBlock) },
		'markup.link': { fg: RGBA.fromHex(syntax.markupLink), underline: true },
		'markup.link.url': {
			fg: RGBA.fromHex(syntax.markupLinkUrl),
			underline: true,
		},
	});
}
