'use client';

import { useCallback, useMemo } from 'react';
import {
  useEventStream,
  type ConnectionStatus,
  type TicketStatusChange,
} from '@/hooks/use-event-stream';
import { useNotifications } from '@/hooks/use-notifications';
import { useProjectPath } from '@/components/providers/TRPCProvider';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

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

function getNotificationIndicator(
  permission: string,
  isSupported: boolean,
): string | null {
  if (!isSupported) return null;
  switch (permission) {
    case 'granted':
      return null;
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

export function ConnectionStatusIndicator({
  className,
}: ConnectionStatusProps) {
  const { showNotification, permission, isSupported } = useNotifications();
  const projectPath = useProjectPath();
  const utils = trpc.useUtils();

  const handleTicketsChange = useCallback(() => {
    void utils.tickets.list.invalidate();
  }, [utils.tickets.list]);

  const handleProgressChange = useCallback(() => {
    void utils.progress.read.invalidate();
  }, [utils.progress.read]);

  const getTickets = useCallback(() => {
    return utils.tickets.list.getData();
  }, [utils.tickets.list]);

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

  const topics = useMemo(() => ['tickets', 'progress'], []);

  const { connectionStatus } = useEventStream({
    project: projectPath,
    topics,
    onTicketsChange: handleTicketsChange,
    onProgressChange: handleProgressChange,
    onTicketStatusChange: handleTicketStatusChange,
    getTickets,
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
      title={`File watching: ${getStatusText(connectionStatus)}`}
    >
      <span
        className={cn('h-2 w-2 rounded-full', getStatusColor(connectionStatus))}
      />
      <span className="hidden sm:inline">
        {getStatusText(connectionStatus)}
        {notificationIndicator && (
          <span className="ml-1 text-yellow-600">{notificationIndicator}</span>
        )}
      </span>
    </div>
  );
}
