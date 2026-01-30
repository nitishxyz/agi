import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function useFullscreen() {
	const [isFullscreen, setIsFullscreen] = useState(false);

	useEffect(() => {
		const win = getCurrentWindow();
		let unlisten: (() => void) | null = null;

		const checkFullscreen = async () => {
			const fs = await win.isFullscreen();
			setIsFullscreen(fs);
		};

		checkFullscreen();

		win
			.onResized(async () => {
				const fs = await win.isFullscreen();
				setIsFullscreen(fs);
			})
			.then((fn) => {
				unlisten = fn;
			});

		return () => {
			unlisten?.();
		};
	}, []);

	return isFullscreen;
}
