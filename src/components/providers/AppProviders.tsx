'use client';

import { type ReactNode } from 'react';
import { ProjectProvider } from './ProjectProvider';
import { TRPCProvider } from './TRPCProvider';
import { Toaster } from '@/components/ui/toaster';

interface AppProvidersProps {
  children: ReactNode;
  /**
   * Default project path from server environment (RALPH_DIR)
   */
  defaultProjectPath?: string;
}

/**
 * Combined app providers
 * Order matters: ProjectProvider must wrap TRPCProvider
 */
export function AppProviders({
  children,
  defaultProjectPath,
}: AppProvidersProps) {
  return (
    <ProjectProvider defaultProjectPath={defaultProjectPath}>
      <TRPCProvider>
        {children}
        <Toaster />
      </TRPCProvider>
    </ProjectProvider>
  );
}
