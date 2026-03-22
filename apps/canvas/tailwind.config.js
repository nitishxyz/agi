/** @type {import('tailwindcss').Config} */
export default {
	darkMode: 'class',
	content: [
		'./index.html',
		'./src/**/*.{js,ts,jsx,tsx}',
	],
	theme: {
		extend: {
			colors: {
				canvas: {
					bg: 'rgba(14, 14, 16, 0.85)',
					surface: 'rgba(22, 22, 26, 0.9)',
					sidebar: 'rgba(18, 18, 22, 0.75)',
					border: 'rgba(255, 255, 255, 0.06)',
					'border-active': 'rgba(255, 255, 255, 0.12)',
					text: 'rgba(255, 255, 255, 0.9)',
					'text-dim': 'rgba(255, 255, 255, 0.45)',
					'text-muted': 'rgba(255, 255, 255, 0.3)',
					accent: '#6366f1',
					'accent-dim': 'rgba(99, 102, 241, 0.15)',
					focus: 'rgba(99, 102, 241, 0.4)',
				},
			},
			fontFamily: {
				sans: ['IBM Plex Mono', 'monospace'],
				mono: ['IBM Plex Mono', 'monospace'],
			},
			backdropBlur: {
				canvas: '24px',
			},
		},
	},
	plugins: [],
};
