import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Theme, ThemeColors } from './types.ts';
import { themes, DEFAULT_THEME } from './themes/index.ts';
import { buildSyntaxStyle } from './syntax.ts';
import type { SyntaxStyle } from '@opentui/core';

interface ThemeContextValue {
	theme: Theme;
	colors: ThemeColors;
	syntaxStyle: SyntaxStyle;
	themeName: string;
	setTheme: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(name: string): Theme {
	return themes[name] ?? themes[DEFAULT_THEME];
}

export function ThemeProvider({ initialTheme, children }: { initialTheme?: string; children: React.ReactNode }) {
	const [themeName, setThemeName] = useState(
		initialTheme && themes[initialTheme] ? initialTheme : DEFAULT_THEME,
	);

	const setTheme = useCallback((name: string) => {
		if (themes[name]) {
			setThemeName(name);
		}
	}, []);

	const theme = resolveTheme(themeName);
	const syntaxStyle = useMemo(() => buildSyntaxStyle(theme.syntax), [theme.syntax]);

	const value = useMemo<ThemeContextValue>(
		() => ({
			theme,
			colors: theme.colors,
			syntaxStyle,
			themeName,
			setTheme,
		}),
		[theme, syntaxStyle, themeName, setTheme],
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
	const ctx = useContext(ThemeContext);
	if (!ctx) {
		throw new Error('useTheme must be used within a ThemeProvider');
	}
	return ctx;
}
