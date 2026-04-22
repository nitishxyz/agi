import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { useReactQueryDevTools } from "@dev-plugins/react-query";

const queryClient = new QueryClient();

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  // useReactQueryDevTools(queryClient);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
