export const NERD_FONT_FAMILY = '"JetBrainsMono NFM", monospace';

let fontsLoaded = false;
let loadPromise: Promise<void> | null = null;

export function loadNerdFont(): Promise<void> {
	if (fontsLoaded) return Promise.resolve();
	if (loadPromise) return loadPromise;

	loadPromise = doLoad().then(() => {
		fontsLoaded = true;
	});
	return loadPromise;
}

export function isNerdFontLoaded(): boolean {
	return fontsLoaded;
}

async function doLoad(): Promise<void> {
	if (typeof document === 'undefined' || !('FontFace' in window)) return;

	const variants = [
		{
			file: 'JetBrainsMonoNerdFontMono-Regular.woff2',
			weight: '400',
			style: 'normal',
		},
		{
			file: 'JetBrainsMonoNerdFontMono-Bold.woff2',
			weight: '700',
			style: 'normal',
		},
		{
			file: 'JetBrainsMonoNerdFontMono-Italic.woff2',
			weight: '400',
			style: 'italic',
		},
		{
			file: 'JetBrainsMonoNerdFontMono-BoldItalic.woff2',
			weight: '700',
			style: 'italic',
		},
	];

	const loads = variants.map(async (v) => {
		try {
			const url = new URL(`../assets/fonts/${v.file}`, import.meta.url).href;
			const face = new FontFace(
				'JetBrainsMono NFM',
				`url("${url}") format("woff2")`,
				{ weight: v.weight, style: v.style },
			);
			const loaded = await face.load();
			document.fonts.add(loaded);
		} catch {
			// variant not available
		}
	});

	await Promise.allSettled(loads);
}
