import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { apiClient } from '@ottocode/web-sdk/lib';

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			structuralSharing: true,
		},
	},
});

queryClient.prefetchQuery({
	queryKey: ['sessions'],
	queryFn: () => apiClient.getSessions(),
});
queryClient.prefetchQuery({
	queryKey: ['config'],
	queryFn: () => apiClient.getConfig(),
});

export function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<RouterProvider router={router} />
		</QueryClientProvider>
	);
}

export default App;
