'use client';

import { useFileWatch, type ConnectionStatus } from '@/hooks/use-file-watch';
import { cn } from '@/lib/utils';

/**
 * Get indicator dot color based on connection status
 */
function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'bg-green-500';
    case 'connecting':
      return 'bg-yellow-500 animate-pulse';
    case 'disconnected':
      return 'bg-red-500';
  }
}

/**
 * Get display text for connection status
 */
function getStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Live';
    case 'connecting':
      return 'Connecting...';
    case 'disconnected':
      return 'Disconnected';
  }
}

interface ConnectionStatusProps {
  className?: string;
}

/**
 * Connection status indicator for file watch SSE
 * Shows a colored dot and status text
 */
export function ConnectionStatusIndicator({
  className,
}: ConnectionStatusProps) {
  const status = useFileWatch();

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs text-muted-foreground',
        className,
      )}
      title={`File watching: ${getStatusText(status)}`}
    >
      <span className={cn('h-2 w-2 rounded-full', getStatusColor(status))} />
      <span className="hidden sm:inline">{getStatusText(status)}</span>
    </div>
  );
}
