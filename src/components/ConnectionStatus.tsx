'use client';

import { useCallback } from 'react';
import {
  useFileWatch,
  type ConnectionStatus,
  type TicketStatusChange,
} from '@/hooks/use-file-watch';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjectContext } from '@/components/providers/ProjectProvider';
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

/**
 * Get notification permission indicator text
 */
function getNotificationIndicator(
  permission: string,
  isSupported: boolean,
): string | null {
  if (!isSupported) return null;
  switch (permission) {
    case 'granted':
      return null; // Don't show anything when granted
    case 'denied':
      return '(notifications blocked)';
    case 'default':
      return '(notifications pending)';
    default:
      return null;
  }
}

interface ConnectionStatusProps {
  className?: string;
}

/**
 * Connection status indicator for file watch SSE
 * Shows a colored dot and status text
 * Also handles desktop notifications for ticket status changes
 */
export function ConnectionStatusIndicator({
  className,
}: ConnectionStatusProps) {
  const { showNotification, permission, isSupported } = useNotifications();
  const { activeProjectPath, defaultProjectPath } = useProjectContext();

  // Use active project or fall back to default
  const ralphDir = activeProjectPath ?? defaultProjectPath ?? undefined;

  // Handle ticket status changes with desktop notifications
  const handleTicketStatusChange = useCallback(
    (change: TicketStatusChange) => {
      const statusEmoji = change.newStatus === 'completed' ? '✅' : '❌';
      const statusText =
        change.newStatus === 'completed' ? 'completed' : 'failed';

      showNotification({
        title: `Ticket #${change.ticket.id} ${statusText}`,
        body: `${statusEmoji} ${change.ticket.title}`,
        tag: `ticket-${change.ticket.id}`,
      });
    },
    [showNotification],
  );

  const status = useFileWatch({
    onTicketStatusChange: handleTicketStatusChange,
    ralphDir,
  });

  const notificationIndicator = getNotificationIndicator(
    permission,
    isSupported,
  );

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-xs text-muted-foreground',
        className,
      )}
      title={`File watching: ${getStatusText(status)}`}
    >
      <span className={cn('h-2 w-2 rounded-full', getStatusColor(status))} />
      <span className="hidden sm:inline">
        {getStatusText(status)}
        {notificationIndicator && (
          <span className="ml-1 text-yellow-600">{notificationIndicator}</span>
        )}
      </span>
    </div>
  );
}
