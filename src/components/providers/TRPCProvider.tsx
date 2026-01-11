'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, useEffect } from 'react';
import superjson from 'superjson';
import { trpc } from '@/lib/trpc';
import { useProjectContext } from './ProjectProvider';

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser: use relative URL
    return '';
  }
  // SSR: use localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

// Module-level variable to store the current ralph directory
// This is accessed by the httpBatchLink headers callback
let currentRalphDir: string | undefined;

/**
 * Get the current ralph directory for tRPC requests
 * Called by httpBatchLink headers callback
 */
function getRalphDirForHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (currentRalphDir) {
    headers['x-ralph-dir'] = currentRalphDir;
  }
  return headers;
}

// Create clients outside of component to ensure single instance
let queryClientInstance: QueryClient | null = null;
let trpcClientInstance: ReturnType<typeof trpc.createClient> | null = null;

function getQueryClient() {
  if (!queryClientInstance) {
    queryClientInstance = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 1000, // 5 seconds
          refetchOnWindowFocus: true,
        },
      },
    });
  }
  return queryClientInstance;
}

function getTRPCClient() {
  if (!trpcClientInstance) {
    trpcClientInstance = trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers: getRalphDirForHeaders,
        }),
      ],
    });
  }
  return trpcClientInstance;
}

interface TRPCProviderProps {
  children: React.ReactNode;
}

export function TRPCProvider({ children }: TRPCProviderProps) {
  const { activeProjectPath, defaultProjectPath } = useProjectContext();

  // Update the module-level variable when project changes
  useEffect(() => {
    currentRalphDir = activeProjectPath ?? defaultProjectPath ?? undefined;
  }, [activeProjectPath, defaultProjectPath]);

  // Use stable client instances
  const [queryClient] = useState(getQueryClient);
  const [trpcClient] = useState(getTRPCClient);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
