/**
 * Shared TanStack Query client.
 * A module-level instance lets logout clear every cached response (orders, profile, ...)
 * so nothing from one account is ever shown to the next.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error: any) => {
        const message = String(error?.message || '');
        // Do not retry auth/validation failures; retry transient errors twice
        if (/forbidden|not found|invalid|expired|log in/i.test(message)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
