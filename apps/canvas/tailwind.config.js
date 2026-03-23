/** @type {import('tailwindcss').Config} */
export default {
	darkMode: 'class',
	content: [
		'./index.html',
		'./src/**/*.{js,ts,jsx,tsx}',
		'../../packages/web-sdk/src/**/*.{js,ts,jsx,tsx}',
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
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))',
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))',
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))',
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
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
