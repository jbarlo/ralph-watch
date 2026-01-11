'use client';

import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ProgressViewerProps {
  /**
   * Whether to automatically scroll to bottom when content changes
   * @default true
   */
  autoScroll?: boolean;
  /**
   * Height of the scroll area (CSS value)
   * @default '300px'
   */
  height?: string;
  /**
   * Optional title for the card header
   * @default 'Progress Log'
   */
  title?: string;
  /**
   * Whether to wrap the viewer in a card
   * @default true
   */
  showCard?: boolean;
}

/**
 * Component to display progress.txt content with auto-scroll functionality
 */
export function ProgressViewer({
  autoScroll = true,
  height = '300px',
  title = 'Progress Log',
  showCard = true,
}: ProgressViewerProps) {
  const { data: content, isLoading, error } = trpc.progress.read.useQuery();
  const contentRef = useRef<HTMLPreElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (autoScroll && contentRef.current && content) {
      // Find the viewport element within the scroll area
      const viewport = scrollAreaRef.current?.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [content, autoScroll]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <p className="text-sm text-muted-foreground">Loading progress...</p>
      );
    }

    if (error) {
      return (
        <p className="text-sm text-destructive">
          Error loading progress: {error.message}
        </p>
      );
    }

    return (
      <pre
        ref={contentRef}
        className="whitespace-pre-wrap text-xs font-mono text-muted-foreground"
      >
        {content || 'No progress logged yet'}
      </pre>
    );
  };

  const scrollContent = (
    <ScrollArea
      ref={scrollAreaRef}
      className={`h-[${height}]`}
      style={{ height }}
    >
      {renderContent()}
    </ScrollArea>
  );

  if (!showCard) {
    return scrollContent;
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{scrollContent}</CardContent>
    </Card>
  );
}
