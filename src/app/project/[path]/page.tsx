'use client';

import { useState, Suspense } from 'react';
import { trpc } from '@/lib/trpc';
import type { Ticket } from '@/lib/schemas';
import { TicketList } from '@/components/TicketList';
import { TicketFilter, type TicketStatus } from '@/components/TicketFilter';
import { QuickAddBar } from '@/components/QuickAddBar';
import { DescriptionViewer } from '@/components/DescriptionViewer';
import { EditTicketForm } from '@/components/EditTicketForm';
import { DeleteTicketButton } from '@/components/DeleteTicketButton';
import { ConnectionStatusIndicator } from '@/components/ConnectionStatus';
import { RalphSidePanel } from '@/components/RalphSidePanel';
import { MobileLayout } from '@/components/MobileLayout';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useProjectPath } from '@/components/providers/TRPCProvider';
import { useIsMobile } from '@/hooks/use-media-query';
import { useSelectedTicket } from '@/hooks/use-selected-ticket';
import { useResizablePanel } from '@/hooks/use-resizable-panel';
import { ResizableHandle } from '@/components/ResizableHandle';
import { deriveProjectName } from '@/lib/recent-projects';
import {
  getStatusBadgeClass,
  formatStatus,
  dispatchRiffOnTicket,
} from '@/lib/ticket-ui';
import { encodeProjectPath } from '@/lib/project-path';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FileText, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import {
  RightTerminalPane,
  TerminalToggleButton,
  useTerminalWidth,
} from '@/components/RightTerminalPane';

const TICKET_SIDEBAR_CONFIG = {
  storageKey: 'ralph-ticket-sidebar-width',
  defaultWidth: 400,
  minWidth: 250,
  maxWidth: 600,
};

/**
 * Header component showing project name and controls
 */
function Header() {
  const projectPath = useProjectPath();
  const projectName = deriveProjectName(projectPath);

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-4 px-4 lg:px-6">
        <Link href="/" className="text-lg font-semibold hover:text-primary">
          Ralph Watch
        </Link>
        <div className="flex flex-1 items-center gap-2">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{projectName}</span>
            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
              {projectPath}
            </span>
          </div>
        </div>
        <Link href={`/project/${encodeProjectPath(projectPath)}/progress`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Progress Log</span>
          </Button>
        </Link>
        <TerminalToggleButton />
        <ThemeToggle />
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => dispatchRiffOnTicket(ticket)}
                title="Open Claude terminal with ticket context"
              >
                <MessageSquare className="h-4 w-4 mr-1" />
                Riff
              </Button>
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
            <div className="space-y-2">
              <span className="text-sm font-medium">Description:</span>
              <DescriptionViewer
                content={ticket.description}
                className="prose prose-sm dark:prose-invert max-w-none"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Desktop tabs for switching between tickets and details (medium screens only)
 */
interface DesktopTabsProps {
  activeTab: 'tickets' | 'details';
  onTabChange: (tab: 'tickets' | 'details') => void;
}

function DesktopTabs({ activeTab, onTabChange }: DesktopTabsProps) {
  return (
    <div className="hidden md:flex lg:hidden border-b">
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
 * Desktop project content (for md+ screens)
 */
function DesktopProjectContent() {
  const { selectedTicketId, setSelectedTicketId } = useSelectedTicket();
  const [desktopTab, setDesktopTab] = useState<'tickets' | 'details'>(
    'tickets',
  );
  const [statusFilter, setStatusFilter] = useState<TicketStatus>('incomplete');

  const ticketSidebar = useResizablePanel(TICKET_SIDEBAR_CONFIG);

  const { data: tickets } = trpc.tickets.list.useQuery();

  const selectedTicket =
    tickets?.find((t) => t.id === selectedTicketId) ?? null;

  const handleTicketSelect = (ticket: Ticket | null) => {
    setSelectedTicketId(ticket?.id ?? null);
    if (ticket) {
      setDesktopTab('details');
    }
  };

  const handleTicketDeleted = () => {
    setSelectedTicketId(null);
    setDesktopTab('tickets');
  };

  return (
    <>
      <DesktopTabs activeTab={desktopTab} onTabChange={setDesktopTab} />
      <main className="flex flex-1 overflow-hidden">
        <div
          className={cn(
            'hidden md:flex flex-col border-r p-4 flex-shrink-0',
            desktopTab === 'tickets' ? 'md:flex' : 'md:hidden lg:flex',
          )}
          style={{ width: ticketSidebar.width }}
        >
          <div className="mb-4">
            <QuickAddBar />
          </div>
          <div className="mb-4">
            <TicketFilter value={statusFilter} onChange={setStatusFilter} />
          </div>
          <ScrollArea className="flex-1 lg:h-[calc(100vh-11rem)]">
            <TicketList
              onTicketSelect={handleTicketSelect}
              selectedTicketId={selectedTicketId}
              statusFilter={statusFilter}
            />
          </ScrollArea>
        </div>
        <ResizableHandle
          panel={ticketSidebar}
          edge="right"
          className="hidden lg:block"
        />
        <div
          className={cn(
            'hidden flex-1 p-4 lg:block min-w-0',
            desktopTab === 'details' ? 'md:block' : 'md:hidden lg:block',
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
 * Home content wrapper
 */
function HomeContent() {
  const isMobile = useIsMobile();
  const projectPath = useProjectPath();
  const terminalWidth = useTerminalWidth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      {isMobile ? (
        <MobileLayout />
      ) : (
        <>
          <div
            className="flex flex-1 flex-col overflow-hidden"
            style={{ paddingRight: terminalWidth }}
          >
            <div className="flex flex-1 overflow-hidden">
              <div className="flex flex-1 flex-col overflow-hidden">
                <DesktopProjectContent />
              </div>
              <RalphSidePanel />
            </div>
          </div>
          <RightTerminalPane projectPath={projectPath} />
        </>
      )}
    </div>
  );
}

export default function ProjectPage() {
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
