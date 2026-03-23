import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMemo, type ReactNode } from 'react';
import { configureApiClient } from '@ottocode/web-sdk';
import { useWorkspaceRuntimeStore } from '../stores/workspace-runtime-store';
import { useWorkspaceStore } from '../stores/workspace-store';

interface OttoWindow extends Window {
	OTTO_SERVER_URL?: string;
}

export function OttoWorkspaceBoundary({ children }: { children: ReactNode }) {
	const activeWorkspaceId = useWorkspaceStore((state) => state.activeId);
	const runtime = useWorkspaceRuntimeStore((state) =>
		activeWorkspaceId ? state.runtimes[activeWorkspaceId] ?? null : null,
	);

	const runtimeUrl = runtime?.status === 'ready' ? runtime.url : undefined;

	if (typeof window !== 'undefined') {
		(window as OttoWindow).OTTO_SERVER_URL = runtimeUrl;
		configureApiClient();
	}

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

	if (!runtimeUrl) {
		return <>{children}</>;
	}

	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
