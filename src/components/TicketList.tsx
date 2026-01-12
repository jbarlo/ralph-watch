'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import type { Ticket } from '@/lib/schemas';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getStatusBadgeClass, formatStatus } from '@/lib/ticket-ui';
import type { TicketStatus } from '@/components/TicketFilter';

interface TicketCardProps {
  ticket: Ticket;
  isSelected: boolean;
  onSelect: (ticket: Ticket) => void;
  onMarkReady?: (ticketId: number) => void;
  isMarkingReady?: boolean;
}

function TicketCard({
  ticket,
  isSelected,
  onSelect,
  onMarkReady,
  isMarkingReady,
}: TicketCardProps) {
  const isDraft = ticket.status === 'draft';

  const handleMarkReady = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkReady?.(ticket.id);
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/50 active:bg-accent/70',
        'min-h-[56px]',
        isSelected && 'ring-2 ring-primary',
        isDraft && 'opacity-60',
      )}
      onClick={() => onSelect(ticket)}
    >
      <CardHeader className="p-3 md:p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm md:text-base font-medium leading-tight">
            #{ticket.id}: {ticket.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isDraft && onMarkReady && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs min-w-[44px]"
                onClick={handleMarkReady}
                disabled={isMarkingReady}
              >
                {isMarkingReady ? '...' : 'Ready'}
              </Button>
            )}
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 capitalize text-xs',
                getStatusBadgeClass(ticket.status),
              )}
            >
              {formatStatus(ticket.status)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      {ticket.priority !== undefined && (
        <CardContent className="pt-0 px-3 md:px-4 pb-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Priority: {ticket.priority}</span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export interface TicketListProps {
  onTicketSelect?: (ticket: Ticket | null) => void;
  selectedTicketId?: number | null;
  statusFilter?: TicketStatus;
}

export function TicketList({
  onTicketSelect,
  selectedTicketId,
  statusFilter = 'all',
}: TicketListProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<number | null>(
    null,
  );
  const [markingReadyId, setMarkingReadyId] = useState<number | null>(null);

  const effectiveSelectedId =
    selectedTicketId !== undefined ? selectedTicketId : internalSelectedId;

  const { data: tickets, isLoading, error } = trpc.tickets.list.useQuery();
  const utils = trpc.useUtils();

  const markReadyMutation = trpc.tickets.update.useMutation({
    onSuccess: () => {
      utils.tickets.list.invalidate();
      setMarkingReadyId(null);
    },
    onError: () => {
      setMarkingReadyId(null);
    },
  });

  const handleMarkReady = (ticketId: number) => {
    setMarkingReadyId(ticketId);
    markReadyMutation.mutate({ id: ticketId, data: { status: 'pending' } });
  };

  // Filter tickets by status
  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    if (statusFilter === 'all') return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const handleSelect = (ticket: Ticket) => {
    const newSelectedId = effectiveSelectedId === ticket.id ? null : ticket.id;

    if (selectedTicketId === undefined) {
      setInternalSelectedId(newSelectedId);
    }

    if (onTicketSelect) {
      onTicketSelect(newSelectedId ? ticket : null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading tickets...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-destructive">
        Error loading tickets: {error.message}
      </div>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <p className="text-lg font-medium">No tickets found</p>
        <p className="text-sm">Create a ticket to get started</p>
      </div>
    );
  }

  if (filteredTickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
        <p className="text-lg font-medium">No matching tickets</p>
        <p className="text-sm">
          No tickets with status &quot;{statusFilter.replace(/_/g, ' ')}&quot;
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {filteredTickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          isSelected={effectiveSelectedId === ticket.id}
          onSelect={handleSelect}
          onMarkReady={handleMarkReady}
          isMarkingReady={markingReadyId === ticket.id}
        />
      ))}
    </div>
  );
}
