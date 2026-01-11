'use client';

import { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useProcessOutput,
  type ProcessOutputConnectionStatus,
} from '@/hooks/use-process-output';
import { cn } from '@/lib/utils';

export interface ProcessOutputViewerProps {
  /**
   * Process ID to subscribe to
   */
  processId: string | null | undefined;
  /**
   * Height of the scroll area (CSS value)
   * @default '300px'
   */
  height?: string;
  /**
   * Optional title for the card header
   * @default 'Process Output'
   */
  title?: string;
  /**
   * Whether to wrap the viewer in a card
   * @default true
   */
  showCard?: boolean;
  /**
   * Initial auto-scroll state
   * @default true
   */
  initialAutoScroll?: boolean;
}

/**
 * Get connection status badge styling
 */
function getStatusBadge(status: ProcessOutputConnectionStatus) {
  switch (status) {
    case 'connected':
      return { variant: 'default' as const, label: 'Connected' };
    case 'connecting':
      return { variant: 'secondary' as const, label: 'Connecting...' };
    case 'disconnected':
      return { variant: 'outline' as const, label: 'Disconnected' };
  }
}

/**
 * Component to display real-time process output with auto-scroll functionality
 */
export function ProcessOutputViewer({
  processId,
  height = '300px',
  title = 'Process Output',
  showCard = true,
  initialAutoScroll = true,
}: ProcessOutputViewerProps) {
  const { lines, exitCode, connectionStatus } = useProcessOutput(processId);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(initialAutoScroll);

  // Auto-scroll to bottom when new lines arrive
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
