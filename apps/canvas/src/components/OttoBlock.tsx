import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
	ChatInputContainer,
	configureApiClient,
	MessageThreadContainer,
	NewSessionLanding,
} from '@ottocode/web-sdk';
import type { Block } from '../stores/canvas-store';
import { useCanvasStore } from '../stores/canvas-store';
import { useWorkspaceRuntimeStore } from '../stores/workspace-runtime-store';
import { useWorkspaceStore } from '../stores/workspace-store';

interface OttoBlockProps {
	block: Block;
	isFocused: boolean;
}

interface OttoWindow extends Window {
	OTTO_SERVER_URL?: string;
}

function OttoRuntimeBoundary({
	runtimeUrl,
	children,
}: {
	runtimeUrl: string;
	children: ReactNode;
}) {
	const queryClient = useMemo(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						refetchOnWindowFocus: false,
						retry: 1,
						staleTime: 10_000,
					},
				},
			}),
		[runtimeUrl],
	);

	if (typeof window !== 'undefined') {
		(window as OttoWindow).OTTO_SERVER_URL = runtimeUrl;
		configureApiClient();
	}

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function OttoRuntimeState({
	title,
	description,
	isLoading = false,
}: {
	title: string;
	description: string;
	isLoading?: boolean;
}) {
	return (
		<div className="flex h-full items-center justify-center px-6">
			<div className="max-w-md space-y-3 text-center">
				{isLoading ? (
					<LoaderCircle size={24} className="mx-auto animate-spin text-canvas-text-muted" />
				) : null}
				<p className="text-[13px] font-medium text-canvas-text-dim">{title}</p>
				<p className="whitespace-pre-wrap break-words text-[11px] leading-5 text-canvas-text-muted">{description}</p>
			</div>
		</div>
	);
}

export function OttoBlock({ block }: OttoBlockProps) {
	const [sessionId, setSessionId] = useState<string | null>(block.sessionId ?? null);
	const activeWorkspaceId = useWorkspaceStore((s) => s.activeId);
	const runtime = useWorkspaceRuntimeStore((s) =>
		activeWorkspaceId ? s.runtimes[activeWorkspaceId] ?? null : null,
	);
	const setFocused = useCanvasStore((s) => s.setFocused);
	const setBlockSessionId = useCanvasStore((s) => s.setBlockSessionId);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setSessionId(block.sessionId ?? null);
	}, [block.sessionId]);

	const handleSessionCreated = useCallback(
		(id: string) => {
			setSessionId(id);
			setBlockSessionId(block.id, id);
		},
		[block.id, setBlockSessionId],
	);

	const handleNewSession = useCallback(() => {
		setSessionId(null);
		setBlockSessionId(block.id, null);
	}, [block.id, setBlockSessionId]);

	const handleSelectSession = useCallback(
		(id: string) => {
			setSessionId(id);
			setBlockSessionId(block.id, id);
		},
		[block.id, setBlockSessionId],
	);

	return (
		<div
			ref={containerRef}
			className="dark relative flex h-full w-full flex-col overflow-hidden"
			style={{ background: 'hsl(var(--background))' }}
			onClick={() => setFocused(block.id)}
		>
			{!activeWorkspaceId ? (
				<OttoRuntimeState
					title="No workspace selected"
					description="Open a workspace to start an Otto runtime for this block."
				/>
			) : !runtime || runtime.status === 'starting' || runtime.status === 'stopped' ? (
				<OttoRuntimeState
					title="Starting Otto for this workspace"
					description="Canvas is launching `otto serve --no-open` in the workspace root."
					isLoading
				/>
			) : runtime.status === 'error' || !runtime.url ? (
				<OttoRuntimeState
					title="Otto runtime unavailable"
					description={runtime.error ?? 'Failed to start the workspace Otto runtime.'}
				/>
			) : (
				<OttoRuntimeBoundary runtimeUrl={runtime.url}>
					{sessionId ? (
						<>
							<div className="relative flex-1 min-h-0">
								<MessageThreadContainer
									sessionId={sessionId}
									onSelectSession={handleSelectSession}
								/>
							</div>
							<div className="flex-shrink-0 border-t border-border px-2 pb-2">
								<ChatInputContainer
									sessionId={sessionId}
									onNewSession={handleNewSession}
								/>
							</div>
						</>
					) : (
						<NewSessionLanding
							onSessionCreated={handleSessionCreated}
							compact
						/>
					)}
				</OttoRuntimeBoundary>
			)}
		</div>
	);
}
