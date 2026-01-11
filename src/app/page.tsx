'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { Ticket } from '@/lib/schemas';
import { TicketList } from '@/components/TicketList';
import { ScrollArea } from '@/components/ui/scroll-area';
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="hidden sm:inline">Project:</span>
          <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs">
            {isLoading ? '...' : projectPath}
          </code>
        </div>
      </div>
    </header>
  );
}

/**
 * Ticket detail panel showing selected ticket info and progress
 */
interface DetailPanelProps {
  ticket: Ticket | null;
}

function DetailPanel({ ticket }: DetailPanelProps) {
  const { data: progressContent } = trpc.progress.read.useQuery();

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
        <Card className="mt-4 flex-1">
          <CardHeader>
            <CardTitle className="text-base">Progress Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
                {progressContent || 'No progress logged yet'}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
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
            <Badge
              variant="outline"
              className={cn(
                'shrink-0 capitalize',
                getStatusBadgeClass(ticket.status),
              )}
            >
              {formatStatus(ticket.status)}
            </Badge>
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
      <Card className="flex-1">
        <CardHeader>
          <CardTitle className="text-base">Progress Log</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <pre className="whitespace-pre-wrap text-xs font-mono text-muted-foreground">
              {progressContent || 'No progress logged yet'}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>
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

export default function Home() {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [mobileTab, setMobileTab] = useState<'tickets' | 'details'>('tickets');

  const handleTicketSelect = (ticket: Ticket | null) => {
    setSelectedTicket(ticket);
    if (ticket) {
      setMobileTab('details');
    }
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
          <ScrollArea className="h-[calc(100vh-7rem)] lg:h-[calc(100vh-4.5rem)]">
            <TicketList
              onTicketSelect={handleTicketSelect}
              selectedTicketId={selectedTicket?.id ?? null}
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
            <DetailPanel ticket={selectedTicket} />
          </ScrollArea>
        </div>
      </main>
    </div>
  );
}
