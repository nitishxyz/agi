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

async function doLoad(): Promise<void> {
	if (typeof document === 'undefined' || !('FontFace' in window)) return;

	const variants = [
		{
			file: '/fonts/JetBrainsMonoNerdFontMono-Regular.woff2',
			weight: '400',
			style: 'normal',
		},
		{
			file: '/fonts/JetBrainsMonoNerdFontMono-Bold.woff2',
			weight: '700',
			style: 'normal',
		},
		{
			file: '/fonts/JetBrainsMonoNerdFontMono-Italic.woff2',
			weight: '400',
			style: 'italic',
		},
		{
			file: '/fonts/JetBrainsMonoNerdFontMono-BoldItalic.woff2',
			weight: '700',
			style: 'italic',
		},
	];

	await Promise.allSettled(
		variants.map(async (variant) => {
			const face = new FontFace('JetBrainsMono NFM', `url("${variant.file}") format("woff2")`, {
				weight: variant.weight,
				style: variant.style,
			});
			const loaded = await face.load();
			document.fonts.add(loaded);
		}),
	);
}
