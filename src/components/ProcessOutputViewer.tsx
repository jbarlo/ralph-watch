'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProcessOutputLine } from '@/lib/process-runner';
import type { ConnectionStatus } from '@/hooks/use-event-stream';
import { cn } from '@/lib/utils';

export interface ProcessOutputViewerProps {
  lines: ProcessOutputLine[];
  exitCode: number | null;
  connectionStatus: ConnectionStatus;
  processId: string | null | undefined;
  height?: string;
  title?: string;
  showCard?: boolean;
  initialAutoScroll?: boolean;
}

function getStatusBadge(status: ConnectionStatus) {
  switch (status) {
    case 'connected':
      return { variant: 'default' as const, label: 'Connected' };
    case 'connecting':
      return { variant: 'secondary' as const, label: 'Connecting...' };
    case 'disconnected':
      return { variant: 'outline' as const, label: 'Disconnected' };
  }
}

export function ProcessOutputViewer({
  lines,
  exitCode,
  connectionStatus,
  processId,
  height = '300px',
  title = 'Process Output',
  showCard = true,
  initialAutoScroll = true,
}: ProcessOutputViewerProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(initialAutoScroll);

  useEffect(() => {
    if (autoScroll && lines.length > 0) {
      const viewport = scrollAreaRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [lines, autoScroll]);

  const renderContent = () => {
    if (!processId) {
      return (
        <p className="text-sm text-muted-foreground">No process selected</p>
      );
    }

    if (lines.length === 0 && connectionStatus === 'connecting') {
      return (
        <p className="text-sm text-muted-foreground">
          Connecting to process...
        </p>
      );
    }

    if (lines.length === 0 && connectionStatus === 'disconnected') {
      return <p className="text-sm text-muted-foreground">No output yet</p>;
    }

    return (
      <div className="font-mono text-xs">
        {lines.map((line, index) => (
          <div
            key={`${line.timestamp}-${index}`}
            className={cn(
              'whitespace-pre-wrap break-all',
              line.stream === 'stderr' && 'text-destructive',
            )}
          >
            {line.line}
          </div>
        ))}
        {exitCode !== null && (
          <div
            className={cn(
              'mt-2 pt-2 border-t text-sm font-sans',
              exitCode === 0 ? 'text-green-600' : 'text-destructive',
            )}
          >
            Process exited with code {exitCode}
          </div>
        )}
      </div>
    );
  };

  const statusBadge = getStatusBadge(connectionStatus);

  const headerContent = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="font-semibold">{title}</span>
        {processId && (
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAutoScroll(!autoScroll)}
        className="text-xs"
      >
        Auto-scroll: {autoScroll ? 'On' : 'Off'}
      </Button>
    </div>
  );

  const scrollContent = (
    <ScrollArea
      ref={scrollAreaRef}
      className="bg-muted/30 rounded-md p-2"
      style={{ height }}
    >
      {renderContent()}
    </ScrollArea>
  );

  if (!showCard) {
    return (
      <div className="space-y-2">
        {headerContent}
        {scrollContent}
      </div>
    );
  }

  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{headerContent}</CardTitle>
      </CardHeader>
      <CardContent>{scrollContent}</CardContent>
    </Card>
  );
}
