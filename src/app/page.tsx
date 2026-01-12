'use client';

import { useState, Suspense, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { trpc } from '@/lib/trpc';
import type { Ticket } from '@/lib/schemas';
import { TicketList } from '@/components/TicketList';
import { TicketFilter, type TicketStatus } from '@/components/TicketFilter';
import { ProgressViewer } from '@/components/ProgressViewer';
import { EditTicketForm } from '@/components/EditTicketForm';
import { DeleteTicketButton } from '@/components/DeleteTicketButton';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatus';
import { RalphSidePanel } from '@/components/RalphSidePanel';
import { ProjectSwitcher } from '@/components/ProjectSwitcher';
import { useProjectContext } from '@/components/providers/ProjectProvider';
import { getProjectFilter, setProjectFilter } from '@/lib/projects';
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
 * Validate ticket status string
 */
function isValidTicketStatus(
  status: string | undefined,
): status is TicketStatus {
  return (
    status === 'all' ||
    status === 'pending' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'failed'
  );
}

/**
 * Header component showing project switcher and controls
 */
function Header() {
  const { defaultProjectPath, setActiveProject } = useProjectContext();
  const queryClient = useQueryClient();

  const handleProjectChange = () => {
    // Invalidate all queries when project changes to refetch data
    void queryClient.invalidateQueries();
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
        <h1 className="shrink-0 text-lg font-semibold">Ralph Watch</h1>
        <div className="flex flex-1 items-center gap-2">
          <ProjectSwitcher
            defaultProjectPath={defaultProjectPath ?? undefined}
            onProjectChange={(path) => {
              setActiveProject(path);
              handleProjectChange();
            }}
          />
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

/**
 * Get initial filter status for a project from localStorage
 */
function getInitialFilterStatus(projectPath: string | null): TicketStatus {
  if (!projectPath || typeof window === 'undefined') return 'all';
  const savedFilter = getProjectFilter(projectPath);
  const status = savedFilter.status;
  return isValidTicketStatus(status) ? status : 'all';
}

/**
 * Main content component - remounts when project changes via key
 */
interface ProjectContentProps {
  projectPath: string | null;
}

function ProjectContent({ projectPath }: ProjectContentProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'tickets' | 'details'>('tickets');

  // Initialize filter from localStorage during first render
  const [statusFilter, setStatusFilter] = useState<TicketStatus>(() =>
    getInitialFilterStatus(projectPath),
  );

  // Save filter when it changes
  const handleFilterChange = (newStatus: TicketStatus) => {
    setStatusFilter(newStatus);
    if (projectPath) {
      setProjectFilter(projectPath, { status: newStatus });
    }
  };

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
    <>
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
            <TicketFilter value={statusFilter} onChange={handleFilterChange} />
          </div>
          <ScrollArea className="h-[calc(100vh-10rem)] lg:h-[calc(100vh-7.5rem)]">
            <TicketList
              onTicketSelect={handleTicketSelect}
              selectedTicketId={selectedTicketId}
              statusFilter={statusFilter}
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
    </>
  );
}

/**
 * Home content wrapper that handles project context and remounting
 */
function HomeContent() {
  const { activeProjectPath } = useProjectContext();

  // Use project path as key to force remount when project changes
  // This ensures filter state is re-initialized from localStorage
  const projectKey = useMemo(
    () => activeProjectPath ?? 'default',
    [activeProjectPath],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <ProjectContent key={projectKey} projectPath={activeProjectPath} />
        </div>
        <RalphSidePanel />
      </div>
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
