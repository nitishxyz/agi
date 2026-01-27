import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ChatPreview from './ChatPreview';

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
			<ChatPreview data={data} />
		</QueryClientProvider>
	);
}
