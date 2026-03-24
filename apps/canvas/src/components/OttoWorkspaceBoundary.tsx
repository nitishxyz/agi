import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, type ReactNode } from 'react';
import { configureApiClient } from '@ottocode/web-sdk';
import { useWorkspaceRuntimeStore } from '../stores/workspace-runtime-store';

interface OttoWindow extends Window {
	OTTO_SERVER_URL?: string;
}

export function OttoWorkspaceBoundary({
	children,
	workspaceId,
	isActive,
}: {
	children: ReactNode;
	workspaceId: string;
	isActive: boolean;
}) {
	const runtime = useWorkspaceRuntimeStore((state) =>
		workspaceId ? state.runtimes[workspaceId] ?? null : null,
	);

	const runtimeUrl = runtime?.status === 'ready' ? runtime.url : undefined;

	useEffect(() => {
		if (typeof window === 'undefined' || !isActive) return;
		(window as OttoWindow).OTTO_SERVER_URL = runtimeUrl;
		configureApiClient();
	}, [isActive, runtimeUrl]);

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
		[workspaceId],
	);

	if (!isActive || !runtimeUrl) {
		return <>{children}</>;
	}

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
