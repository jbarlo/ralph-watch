'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Streamdown } from 'streamdown';
import { trpc } from '@/lib/trpc';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  /**
   * Whether to show floating scroll buttons
   * @default false
   */
  showScrollButtons?: boolean;
}

export function ProgressViewer({
  autoScroll = true,
  height = '300px',
  title = 'Progress Log',
  showCard = true,
  showScrollButtons = false,
}: ProgressViewerProps) {
  const { data: content, isLoading, error } = trpc.progress.read.useQuery();
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const getViewport = useCallback(() => {
    return scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    ) as HTMLElement | null;
  }, []);

  const scrollToTop = useCallback(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [getViewport]);

  const scrollToBottom = useCallback(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
    }
  }, [getViewport]);

  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const threshold = 20;

      setIsAtTop(scrollTop <= threshold);
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - threshold);
    };

    viewport.addEventListener('scroll', onScroll);
    return () => {
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [getViewport]);

  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    queueMicrotask(() => {
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const threshold = 20;

      setIsAtTop(scrollTop <= threshold);
      setIsAtBottom(scrollTop + clientHeight >= scrollHeight - threshold);
    });
  }, [getViewport, content]);

  useEffect(() => {
    if (autoScroll && contentRef.current && content) {
      const viewport = getViewport();
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [content, autoScroll, getViewport]);

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

    if (!content) {
      return (
        <p className="text-sm text-muted-foreground">No progress logged yet</p>
      );
    }

    return (
      <div
        ref={contentRef}
        className="prose prose-sm dark:prose-invert max-w-none"
      >
        <Streamdown>{content}</Streamdown>
      </div>
    );
  };

  const scrollButtons = showScrollButtons && (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
      <Button
        variant="secondary"
        size="icon"
        onClick={scrollToTop}
        className={cn(
          'h-10 w-10 rounded-full shadow-lg transition-opacity',
          isAtTop ? 'opacity-0 pointer-events-none' : 'opacity-100',
        )}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={scrollToBottom}
        className={cn(
          'h-10 w-10 rounded-full shadow-lg transition-opacity',
          isAtBottom ? 'opacity-0 pointer-events-none' : 'opacity-100',
        )}
        aria-label="Scroll to bottom"
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );

  const scrollContent = (
    <div className="relative h-full">
      <ScrollArea
        ref={scrollAreaRef}
        className={`h-[${height}]`}
        style={{ height }}
      >
        {renderContent()}
      </ScrollArea>
      {scrollButtons}
    </div>
  );

  if (!showCard) {
    return scrollContent;
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="relative">{scrollContent}</CardContent>
    </Card>
  );
}
