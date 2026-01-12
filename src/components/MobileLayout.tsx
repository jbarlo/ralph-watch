'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import type { Ticket } from '@/lib/schemas';
import { TicketList } from '@/components/TicketList';
import { TicketFilter, type TicketStatus } from '@/components/TicketFilter';
import { QuickAddBar } from '@/components/QuickAddBar';
import { ProgressViewer } from '@/components/ProgressViewer';
import { DescriptionViewer } from '@/components/DescriptionViewer';
import { ProcessOutputViewer } from '@/components/ProcessOutputViewer';
import { Terminal as TerminalComponent } from '@/components/Terminal';
import { EditTicketForm } from '@/components/EditTicketForm';
import { DeleteTicketButton } from '@/components/DeleteTicketButton';
import { BottomTabBar, type MobileTab } from '@/components/BottomTabBar';
import { useEventStream } from '@/hooks/use-event-stream';
import { useProjectPath } from '@/components/providers/TRPCProvider';
import { useSelectedTicket } from '@/hooks/use-selected-ticket';
import { useToast } from '@/hooks/use-toast';
import { getStatusBadgeClass, formatStatus } from '@/lib/ticket-ui';
import type { ProcessOutputLine } from '@/lib/process-runner';
import type { CommandConfig } from '@/lib/project-config';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Play,
  Zap,
  Hammer,
  Terminal,
  Square,
  Trash2,
  RefreshCw,
  Settings,
  type LucideIcon,
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  play: Play,
  zap: Zap,
  hammer: Hammer,
  terminal: Terminal,
  square: Square,
  trash: Trash2,
  refresh: RefreshCw,
  settings: Settings,
};

function getIcon(iconName?: string): LucideIcon {
  if (!iconName) return Terminal;
  return iconMap[iconName.toLowerCase()] ?? Terminal;
}

interface MobileTicketDetailProps {
  ticket: Ticket;
  onBack: () => void;
  onTicketDeleted: () => void;
}

function MobileTicketDetail({
  ticket,
  onBack,
  onTicketDeleted,
}: MobileTicketDetailProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleEditSuccess = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="p-4">
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
    <div className="p-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4">
        ← Back to list
      </Button>
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
            <div className="space-y-2">
              <span className="text-sm font-medium">Description:</span>
              <DescriptionViewer
                content={ticket.description}
                className="prose prose-sm dark:prose-invert max-w-none"
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
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
        </CardContent>
      </Card>
    </div>
  );
}

interface RunningProcess {
  id: string;
  label: string;
}

export function MobileLayout() {
  const { toast } = useToast();
  const projectPath = useProjectPath();
  const [activeTab, setActiveTab] = useState<MobileTab>('tickets');
  const [statusFilter, setStatusFilter] = useState<TicketStatus>('incomplete');
  const { selectedTicketId, setSelectedTicketId } = useSelectedTicket();
  const showTicketDetail = selectedTicketId !== null;

  // Run tab state
  const [runningProcess, setRunningProcess] = useState<RunningProcess | null>(
    null,
  );
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [lines, setLines] = useState<ProcessOutputLine[]>([]);
  const [processExitCode, setProcessExitCode] = useState<number | null>(null);

  // Terminal tab state
  const [isTerminalConnected, setIsTerminalConnected] = useState(false);

  const { data: tickets } = trpc.tickets.list.useQuery();
  const configQuery = trpc.config.get.useQuery();
  const commands = configQuery.data?.commands ?? [];

  const selectedTicket =
    tickets?.find((t) => t.id === selectedTicketId) ?? null;

  const topics = useMemo(() => {
    const t: string[] = [];
    if (runningProcess) {
      t.push(`process:${runningProcess.id}`);
    }
    return t;
  }, [runningProcess]);

  const handleProcessOutput = useCallback(
    (processId: string, line: ProcessOutputLine) => {
      if (runningProcess && processId === runningProcess.id) {
        setLines((prev) => [...prev, line]);
      }
    },
    [runningProcess],
  );

  const handleProcessExit = useCallback(
    (processId: string, code: number | null) => {
      if (runningProcess && processId === runningProcess.id) {
        setProcessExitCode(code);
      }
    },
    [runningProcess],
  );

  const { connectionStatus } = useEventStream({
    project: projectPath,
    topics,
    onProcessOutput: handleProcessOutput,
    onProcessExit: handleProcessExit,
  });

  const startMutation = trpc.process.start.useMutation({
    onSuccess: (handle, variables) => {
      const label =
        commands.find((c) => c.cmd === variables.command)?.label ?? 'Command';
      setRunningProcess({ id: handle.id, label });
      setLastExitCode(null);
      setLines([]);
      setProcessExitCode(null);
      toast({
        title: `Running: ${label}`,
        description: `Process started (PID: ${handle.pid})`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start process',
        variant: 'destructive',
      });
    },
  });

  const killMutation = trpc.process.kill.useMutation({
    onSuccess: () => {
      toast({
        title: 'Process stopped',
        description: 'The process was terminated',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to stop process',
        variant: 'destructive',
      });
    },
  });

  const prevExitCodeRef = useRef<number | null>(null);

  const handleProcessComplete = useCallback(
    (code: number) => {
      setLastExitCode(code);
      setRunningProcess(null);
      if (code === 0) {
        toast({
          title: 'Process completed',
          description: 'Command finished successfully',
        });
      } else {
        toast({
          title: 'Process failed',
          description: `Command exited with code ${code}`,
          variant: 'destructive',
        });
      }
    },
    [toast],
  );

  useEffect(() => {
    if (
      runningProcess &&
      processExitCode !== null &&
      prevExitCodeRef.current === null
    ) {
      queueMicrotask(() => handleProcessComplete(processExitCode));
    }
    prevExitCodeRef.current = processExitCode;
  }, [runningProcess, processExitCode, handleProcessComplete]);

  const isRunning = runningProcess !== null && processExitCode === null;
  const isStarting = startMutation.isPending;
  const isStopping = killMutation.isPending;
  const buttonsDisabled = isRunning || isStarting;
  const hasOutput = lines.length > 0 || lastExitCode !== null;

  const handleRunCommand = (command: CommandConfig) => {
    if (isRunning || isStarting) return;
    startMutation.mutate({ command: command.cmd });
  };

  const handleStop = () => {
    if (!runningProcess || isStopping) return;
    killMutation.mutate({ id: runningProcess.id });
  };

  const handleClearOutput = () => {
    setLastExitCode(null);
    setLines([]);
  };

  const handleTicketSelect = (ticket: Ticket | null) => {
    setSelectedTicketId(ticket?.id ?? null);
  };

  const handleTicketDeleted = () => {
    setSelectedTicketId(null);
  };

  const handleBackToList = () => {
    setSelectedTicketId(null);
  };

  const getStatusText = () => {
    if (isStarting) return 'Starting...';
    if (isRunning) return `Running: ${runningProcess.label}...`;
    if (lastExitCode !== null) {
      return lastExitCode === 0 ? 'Completed' : `Failed (code ${lastExitCode})`;
    }
    return null;
  };

  const statusText = getStatusText();

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] pb-16">
      {activeTab === 'tickets' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {showTicketDetail && selectedTicket ? (
            <ScrollArea className="flex-1">
              <MobileTicketDetail
                ticket={selectedTicket}
                onBack={handleBackToList}
                onTicketDeleted={handleTicketDeleted}
              />
            </ScrollArea>
          ) : (
            <>
              <div className="border-b p-3">
                <TicketFilter value={statusFilter} onChange={setStatusFilter} />
              </div>
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-3">
                  <TicketList
                    onTicketSelect={handleTicketSelect}
                    selectedTicketId={selectedTicketId}
                    statusFilter={statusFilter}
                  />
                </div>
              </ScrollArea>
              <div className="border-t p-3 shrink-0">
                <QuickAddBar />
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'progress' && (
        <div className="flex flex-1 flex-col overflow-hidden p-4">
          <ProgressViewer height="100%" showCard={false} />
        </div>
      )}

      {activeTab === 'run' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b p-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {commands.map((command, index) => {
                const Icon = getIcon(command.icon);
                return (
                  <Button
                    key={index}
                    size="default"
                    variant={command.destructive ? 'destructive' : 'default'}
                    className="flex-1 min-w-[100px] h-11"
                    onClick={() => handleRunCommand(command)}
                    disabled={buttonsDisabled}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {isStarting ? 'Starting...' : command.label}
                  </Button>
                );
              })}
            </div>

            {isRunning && (
              <Button
                size="default"
                variant="destructive"
                className="w-full h-11"
                onClick={handleStop}
                disabled={isStopping}
              >
                {isStopping ? 'Stopping...' : 'Stop'}
              </Button>
            )}

            {statusText && (
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'text-sm',
                    isRunning && 'text-blue-600 animate-pulse',
                    lastExitCode === 0 && 'text-green-600',
                    lastExitCode !== null &&
                      lastExitCode !== 0 &&
                      'text-destructive',
                  )}
                >
                  {statusText}
                </span>
                {isRunning && (
                  <span className="text-xs text-muted-foreground">
                    {connectionStatus === 'connected'
                      ? 'Connected'
                      : connectionStatus === 'connecting'
                        ? 'Connecting...'
                        : 'Disconnected'}
                  </span>
                )}
              </div>
            )}

            {!isRunning && lastExitCode !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearOutput}
                className="w-full"
              >
                Clear
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-hidden p-3">
            {hasOutput || isRunning ? (
              <ProcessOutputViewer
                lines={lines}
                exitCode={processExitCode}
                connectionStatus={connectionStatus}
                processId={runningProcess?.id ?? null}
                height="100%"
                title="Output"
                showCard={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No output yet. Run a command to see output.
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'terminal' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <TerminalComponent
            projectPath={projectPath}
            className="flex-1 min-h-0"
            showControls
            onConnectionChange={setIsTerminalConnected}
          />
        </div>
      )}

      <BottomTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isProcessRunning={isRunning}
        isTerminalConnected={isTerminalConnected}
      />
    </div>
  );
}
