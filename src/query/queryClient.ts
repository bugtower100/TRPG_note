import { QueryClient } from '@tanstack/react-query';

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 5_000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
    },
  },
});
