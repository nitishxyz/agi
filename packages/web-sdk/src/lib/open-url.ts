export function openUrl(url: string) {
	if (window.self !== window.top) {
		window.parent.postMessage({ type: 'agi-open-url', url }, '*');
	} else {
		window.open(url, '_blank');
	}
}
