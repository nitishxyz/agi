import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	getGhosttyStatus,
	inputGhosttyText,
	type GhosttyStatus,
} from '../lib/ghostty';
import {
	useNativeBlockHost,
	useNativeBlockRuntime,
} from '../lib/native-block-runtime';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';

interface GhosttyBlockProps {
	block: Block;
	isFocused: boolean;
}

export function GhosttyBlock({ block }: GhosttyBlockProps) {
	const runtimeHostRef = useNativeBlockHost(block.id, 'terminal');
	const runtime = useNativeBlockRuntime(block.id);
	const setFocused = useCanvasStore((s) => s.setFocused);
	const [status, setStatus] = useState<GhosttyStatus | null>(null);
	const [statusError, setStatusError] = useState<string | null>(null);

	const unavailableMessage = useMemo(() => {
		if (runtime.error) return runtime.error;
		if (statusError) return statusError;
		if (!status) return 'Checking local Ghostty installation…';
		if (!status.available) return status.message;
		return null;
	}, [runtime.error, status, statusError]);

	useEffect(() => {
		let cancelled = false;

		void getGhosttyStatus()
			.then((nextStatus) => {
				if (cancelled) return;
				setStatus(nextStatus);
			})
			.catch((error) => {
				if (cancelled) return;
				setStatusError(error instanceof Error ? error.message : String(error));
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const sendText = useCallback(
		(text: string) => {
			if (!text) return;
			void inputGhosttyText(block.id, text).catch((error) => {
				setStatusError(error instanceof Error ? error.message : String(error));
			});
		},
		[block.id],
	);

	return (
		<div className="relative h-full w-full overflow-hidden bg-transparent">
			<div
				ref={runtimeHostRef}
				data-native-block-host="terminal"
				data-block-id={block.id}
				tabIndex={0}
				className="h-full w-full outline-none"
				onFocus={() => setFocused(block.id)}
				onMouseDown={(event) => {
					event.stopPropagation();
					setFocused(block.id);
				}}
				onPaste={(event) => {
					const text = event.clipboardData.getData('text/plain');
					if (!text) return;
					event.preventDefault();
					event.stopPropagation();
					sendText(text);
				}}
			/>

			{unavailableMessage && (
				<div className="absolute inset-0 flex items-center justify-center bg-[#09090b] px-6 text-center">
					<div className="max-w-[340px] space-y-2">
						<p className="text-[12px] font-medium text-canvas-text-dim">
							Ghostty block unavailable
						</p>
						<p className="text-[11px] leading-5 text-canvas-text-muted">
							{unavailableMessage}
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
