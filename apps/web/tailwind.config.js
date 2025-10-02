/** @type {import('tailwindcss').Config} */
export default {
	content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				background: '#0a0a0a',
				surface: '#18181b',
				border: '#27272a',
			},
			fontFamily: {
				mono: ['IBM Plex Mono', 'monospace'],
			},
		},
	},
	plugins: [],
};
