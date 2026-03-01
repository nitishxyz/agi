import type { Theme } from '../types.ts';
import { tokyoNight } from './tokyo-night.ts';
import { light } from './light.ts';
import { catppuccinMocha } from './catppuccin-mocha.ts';
import { nord } from './nord.ts';
import { gruvbox } from './gruvbox.ts';
import { monokai } from './monokai.ts';
import { dracula } from './dracula.ts';
import { solarizedDark } from './solarized-dark.ts';
import { ayuDark } from './ayu-dark.ts';

export const themes: Record<string, Theme> = {
	'tokyo-night': tokyoNight,
	light,
	'catppuccin-mocha': catppuccinMocha,
	nord,
	gruvbox,
	monokai,
	dracula,
	'solarized-dark': solarizedDark,
	'ayu-dark': ayuDark,
};

export const themeList: Theme[] = Object.values(themes);

export const DEFAULT_THEME = 'tokyo-night';

export {
	tokyoNight,
	light,
	catppuccinMocha,
	nord,
	gruvbox,
	monokai,
	dracula,
	solarizedDark,
	ayuDark,
};
