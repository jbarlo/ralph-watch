'use client';

import { useState, Suspense } from 'react';
import { trpc } from '@/lib/trpc';
import type { Ticket } from '@/lib/schemas';
import { TicketList } from '@/components/TicketList';
import { TicketFilter } from '@/components/TicketFilter';
import { useTicketFilter } from '@/hooks/use-ticket-filter';
import { ProgressViewer } from '@/components/ProgressViewer';
import { EditTicketForm } from '@/components/EditTicketForm';
import { DeleteTicketButton } from '@/components/DeleteTicketButton';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatus';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Get badge styling based on ticket status
 */
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
    case 'in_progress':
      return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
    case 'completed':
      return 'bg-green-500/20 text-green-700 border-green-500/30';
    case 'failed':
      return 'bg-red-500/20 text-red-700 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
  }
}

/**
 * Format status for display
 */
function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}

/**
 * Header component showing project path
 */
function Header() {
  const { data: projectPath, isLoading } =
    trpc.config.getProjectPath.useQuery();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
        <h1 className="text-lg font-semibold">Ralph Watch</h1>
        <div className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Project:</span>
          <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
            {isLoading ? '...' : projectPath}
          </code>
        </div>
        <ConnectionStatusIndicator />
      </div>
    </header>
  );
}

/**
 * Ticket detail panel showing selected ticket info and progress
 */
interface DetailPanelProps {
  ticket: Ticket | null;
  onTicketUpdated?: () => void;
  onTicketDeleted?: () => void;
}

function DetailPanel({
  ticket,
  onTicketUpdated,
  onTicketDeleted,
}: DetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleEditSuccess = () => {
    setIsEditing(false);
    onTicketUpdated?.();
  };

  if (!ticket) {
    return (
      <div className="flex h-full flex-col">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-base">Ticket Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Select a ticket to view details
            </p>
          </CardContent>
        </Card>
        <div className="mt-4">
          <ProgressViewer height="300px" />
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex h-full flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Edit Ticket #{ticket.id}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EditTicketForm
              ticket={ticket}
              onSuccess={handleEditSuccess}
              onCancel={() => setIsEditing(false)}
            />
          </CardContent>
        </Card>
        <ProgressViewer height="300px" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">
              #{ticket.id}: {ticket.title}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 capitalize',
                  getStatusBadgeClass(ticket.status),
                )}
              >
                {formatStatus(ticket.status)}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
              <DeleteTicketButton
                ticketId={ticket.id}
                ticketTitle={ticket.title}
                onSuccess={onTicketDeleted}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.priority !== undefined && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Priority:</span>
              <span className="text-muted-foreground">{ticket.priority}</span>
            </div>
          )}
          {ticket.description && (
            <div className="space-y-1">
              <span className="text-sm font-medium">Description:</span>
              <p className="text-sm text-muted-foreground">
                {ticket.description}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      <ProgressViewer height="300px" />
    </div>
  );
}

/**
 * Mobile tabs for switching between tickets and details
 */
interface MobileTabsProps {
  activeTab: 'tickets' | 'details';
  onTabChange: (tab: 'tickets' | 'details') => void;
}

function MobileTabs({ activeTab, onTabChange }: MobileTabsProps) {
  return (
    <div className="flex border-b lg:hidden">
      <button
        className={cn(
          'flex-1 px-4 py-2 text-sm font-medium transition-colors',
          activeTab === 'tickets'
            ? 'border-b-2 border-primary text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => onTabChange('tickets')}
      >
        Tickets
      </button>
      <button
        className={cn(
          'flex-1 px-4 py-2 text-sm font-medium transition-colors',
          activeTab === 'details'
            ? 'border-b-2 border-primary text-foreground'
            : 'text-muted-foreground hover:text-foreground',
        )}
        onClick={() => onTabChange('details')}
      >
        Details
      </button>
    </div>
  );
}

function HomeContent() {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'tickets' | 'details'>('tickets');
  const { status, setStatus } = useTicketFilter();

  // Fetch tickets to get the selected ticket data
  const { data: tickets } = trpc.tickets.list.useQuery();

  // Get the selected ticket from the fetched list
  const selectedTicket =
    tickets?.find((t) => t.id === selectedTicketId) ?? null;

  const handleTicketSelect = (ticket: Ticket | null) => {
    setSelectedTicketId(ticket?.id ?? null);
    if (ticket) {
      setMobileTab('details');
    }
  };

  const handleTicketDeleted = () => {
    setSelectedTicketId(null);
    setMobileTab('tickets');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <MobileTabs activeTab={mobileTab} onTabChange={setMobileTab} />
      <main className="flex flex-1 overflow-hidden">
        {/* Desktop: Split view */}
        {/* Mobile: Tab-based navigation */}
        <div
          className={cn(
            'w-full border-r p-4 lg:w-[400px] lg:block',
            mobileTab === 'tickets' ? 'block' : 'hidden',
          )}
        >
          <div className="mb-4">
            <TicketFilter value={status} onChange={setStatus} />
          </div>
          <ScrollArea className="h-[calc(100vh-10rem)] lg:h-[calc(100vh-7.5rem)]">
            <TicketList
              onTicketSelect={handleTicketSelect}
              selectedTicketId={selectedTicketId}
              statusFilter={status}
            />
          </ScrollArea>
        </div>
        <div
          className={cn(
            'flex-1 p-4 lg:block',
            mobileTab === 'details' ? 'block' : 'hidden',
          )}
        >
          <ScrollArea className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-4.5rem)]">
            <DetailPanel
              ticket={selectedTicket}
              onTicketDeleted={handleTicketDeleted}
            />
          </ScrollArea>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
