import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import {
	createGhosttyBlock,
	getGhosttyStatus,
	inputGhosttyText,
	isTauriRuntime,
	setGhosttyBlockFocus,
	updateGhosttyBlock,
	type GhosttyStatus,
} from '../lib/ghostty';

interface GhosttyBlockProps {
	block: Block;
	isFocused: boolean;
}

interface BoundsSnapshot {
	x: number;
	y: number;
	width: number;
	height: number;
	viewportHeight: number;
	scaleFactor: number;
	focused: boolean;
}


function areBoundsEqual(a: BoundsSnapshot | null, b: BoundsSnapshot) {
	if (!a) return false;
	return (
		Math.abs(a.x - b.x) < 0.5 &&
		Math.abs(a.y - b.y) < 0.5 &&
		Math.abs(a.width - b.width) < 0.5 &&
		Math.abs(a.height - b.height) < 0.5 &&
		a.viewportHeight === b.viewportHeight &&
		Math.abs(a.scaleFactor - b.scaleFactor) < 0.01 &&
		a.focused === b.focused
	);
}

function getBoundsSnapshot(element: HTMLDivElement, focused: boolean): BoundsSnapshot {
	const rect = element.getBoundingClientRect();
	return {
		x: rect.left,
		y: rect.top,
		width: rect.width,
		height: rect.height,
		viewportHeight: window.innerHeight,
		scaleFactor: window.devicePixelRatio || 1,
		focused,
	};
}

export function GhosttyBlock({ block, isFocused }: GhosttyBlockProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const lastBoundsRef = useRef<BoundsSnapshot | null>(null);
	const [status, setStatus] = useState<GhosttyStatus | null>(null);
	const [created, setCreated] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const setFocused = useCanvasStore((s) => s.setFocused);

	const unavailableMessage = useMemo(() => {
		if (error) return error;
		if (!status) return 'Checking local Ghostty installation…';
		if (!status.available) return status.message;
		return null;
	}, [error, status]);

	useEffect(() => {
		let cancelled = false;

		getGhosttyStatus()
			.then(async (nextStatus) => {
				if (cancelled) return;
				setStatus(nextStatus);
				if (!nextStatus.available || !isTauriRuntime()) {
					return;
				}

				await createGhosttyBlock(block.id).catch((createError) => {
					throw createError;
				});
				if (hostRef.current) {
					const nextBounds = getBoundsSnapshot(hostRef.current, isFocused);
					lastBoundsRef.current = nextBounds;
					await updateGhosttyBlock(block.id, nextBounds);
				}
				if (!cancelled) {
					setCreated(true);
				}
			})
			.catch((nextError) => {
				if (!cancelled) {
					setError(nextError instanceof Error ? nextError.message : String(nextError));
				}
			});

		return () => {
			cancelled = true;
		};
	}, [block.id]);

	useEffect(() => {
		if (!created || !isFocused) {
			return;
		}

		const timeout = window.setTimeout(() => {
			void setGhosttyBlockFocus(block.id, true).catch((focusError) => {
				setError(focusError instanceof Error ? focusError.message : String(focusError));
			});
		}, 60);

		return () => {
			window.clearTimeout(timeout);
		};
	}, [block.id, created, isFocused]);

	useEffect(() => {
		if (!created || !hostRef.current) {
			return;
		}

		let frame = 0;
		let active = true;

		const tick = () => {
			if (!active || !hostRef.current) {
				return;
			}

			const nextBounds = getBoundsSnapshot(hostRef.current, isFocused);

			if (!areBoundsEqual(lastBoundsRef.current, nextBounds)) {
				lastBoundsRef.current = nextBounds;
				void updateGhosttyBlock(block.id, nextBounds).catch((updateError) => {
					setError(updateError instanceof Error ? updateError.message : String(updateError));
				});
			}

			frame = window.requestAnimationFrame(tick);
		};

		frame = window.requestAnimationFrame(tick);

		return () => {
			active = false;
			window.cancelAnimationFrame(frame);
		};
	}, [block.id, created, isFocused]);

	const sendText = useCallback(
		(text: string) => {
			if (!created || !text) return;
			void inputGhosttyText(block.id, text).catch((inputError) => {
				setError(inputError instanceof Error ? inputError.message : String(inputError));
			});
		},
		[block.id, created],
	);


	return (
		<div className="relative h-full w-full overflow-hidden bg-transparent">
			<div
				ref={hostRef}
				tabIndex={0}
				className="h-full w-full outline-none"
				onFocus={() => setFocused(block.id)}
				onMouseDown={() => {
					setFocused(block.id);
					hostRef.current?.focus();
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
					<div className="space-y-2 max-w-[340px]">
						<p className="text-[12px] font-medium text-canvas-text-dim">Ghostty block unavailable</p>
						<p className="text-[11px] leading-5 text-canvas-text-muted">{unavailableMessage}</p>
					</div>
				</div>
			)}
		</div>
	);
}
