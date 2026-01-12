'use client';

import { createContext, useContext, type ReactNode, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import { trpc } from '@/lib/trpc';

function getBaseUrl() {
  if (typeof window !== 'undefined') {
    return '';
  }
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

interface ProjectContextValue {
  projectPath: string;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

/**
 * Hook to access the current project path from URL
 */
export function useProjectPath(): string {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectPath must be used within TRPCProvider');
  }
  return context.projectPath;
}

interface TRPCProviderProps {
  children: ReactNode;
  projectPath: string;
}

export function TRPCProvider({ children, projectPath }: TRPCProviderProps) {
  // Create fresh clients when projectPath changes
  // This ensures React Query cache is scoped per-project
  const { queryClient, trpcClient } = useMemo(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 1000,
          refetchOnWindowFocus: true,
        },
      },
    });

    const tc = trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers: () => ({
            'x-ralph-dir': projectPath,
          }),
        }),
      ],
    });

    return { queryClient: qc, trpcClient: tc };
  }, [projectPath]);

  return (
    <ProjectContext.Provider value={{ projectPath }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </trpc.Provider>
    </ProjectContext.Provider>
  );
}
