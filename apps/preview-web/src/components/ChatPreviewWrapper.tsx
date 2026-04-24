import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const ChatPreview = lazy(() => import('./ChatPreview'));

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
			refetchOnWindowFocus: false,
		},
	},
});

interface ChatPreviewWrapperProps {
	data: {
		shareId: string;
		title: string | null;
		description: string | null;
		sessionData: Record<string, unknown>;
		createdAt: number;
		viewCount: number;
	};
}

export default function ChatPreviewWrapper({ data }: ChatPreviewWrapperProps) {
	return (
		<QueryClientProvider client={queryClient}>
			<Suspense fallback={null}>
				<ChatPreview data={data} />
			</Suspense>
		</QueryClientProvider>
	);
}
