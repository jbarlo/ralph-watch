'use client';

import { Suspense } from 'react';
import { ProgressViewer } from '@/components/ProgressViewer';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatus';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useProjectPath } from '@/components/providers/TRPCProvider';
import { deriveProjectName } from '@/lib/recent-projects';
import { encodeProjectPath } from '@/lib/project-path';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

function Header() {
  const projectPath = useProjectPath();
  const projectName = deriveProjectName(projectPath);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
        <Link href={`/project/${encodeProjectPath(projectPath)}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Tickets</span>
          </Button>
        </Link>
        <div className="flex flex-1 items-center gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{projectName}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
              Progress Log
            </span>
          </div>
        </div>
        <ThemeToggle />
        <ConnectionStatusIndicator />
      </div>
    </header>
  );
}

function ProgressPageContent() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 flex-col overflow-hidden p-4">
        <ProgressViewer
          height="calc(100vh - 7rem)"
          showCard={false}
          showScrollButtons={true}
          autoScroll={false}
        />
      </main>
    </div>
  );
}

export default function ProgressPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <ProgressPageContent />
    </Suspense>
  );
}
