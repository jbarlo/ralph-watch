'use client';

import { useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Zap,
  Hammer,
  Terminal,
  Square,
  Trash2,
  RefreshCw,
  Settings,
  Radio,
  type LucideIcon,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ProcessOutputViewer } from '@/components/ProcessOutputViewer';
import { useEventStream } from '@/hooks/use-event-stream';
import { useProjectPath } from '@/components/providers/TRPCProvider';
import {
  processReducer,
  initialProcessState,
  isStarting,
  isProcessRunning,
  isCompleted,
  getProcessId,
  getLines,
} from '@/lib/process-state';
import type { ProcessOutputLine } from '@/lib/process-runner';
import type { CommandConfig } from '@/lib/project-config';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState } from 'react';

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

export function RalphSidePanel() {
  const { toast } = useToast();
  const projectPath = useProjectPath();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [state, dispatch] = useReducer(processReducer, initialProcessState);
  const [confirmCommand, setConfirmCommand] = useState<CommandConfig | null>(
    null,
  );
  const [commandLabel, setCommandLabel] = useState<string | null>(null);

  const configQuery = trpc.config.get.useQuery();
  const commands = configQuery.data?.commands ?? [];

  const listQuery = trpc.process.list.useQuery(undefined, {
    enabled: !isProcessRunning(state) && !isStarting(state),
    refetchInterval: 5000,
  });
  const runningProcesses = listQuery.data ?? [];

  const processId = getProcessId(state);
  const lines = getLines(state);
  const exitCode = isCompleted(state) ? state.exitCode : null;

  const getStorageKey = useCallback((id: string) => `ralph-output-${id}`, []);

  useEffect(() => {
    if (!processId || lines.length === 0) return;

    const key = getStorageKey(processId);
    try {
      sessionStorage.setItem(key, JSON.stringify(lines));
    } catch {
      // Storage full or unavailable
    }
  }, [processId, lines, getStorageKey]);

  const restoreAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!processId) {
      restoreAttemptedRef.current = null;
      return;
    }

    if (restoreAttemptedRef.current === processId) {
      return;
    }

    restoreAttemptedRef.current = processId;
    const key = getStorageKey(processId);

    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as ProcessOutputLine[];
        if (parsed.length > 0 && lines.length === 0) {
          dispatch({ type: 'SET_LINES', id: processId, lines: parsed });
        }
      }
    } catch {
      // Invalid data or unavailable
    }
  }, [processId, getStorageKey, lines.length]);

  const topics = useMemo(() => {
    const t: string[] = [];
    if (processId && isProcessRunning(state)) {
      t.push(`process:${processId}`);
    }
    return t;
  }, [processId, state]);

  const handleProcessReplayStart = useCallback((id: string) => {
    dispatch({ type: 'REPLAY_START', id });
  }, []);

  const handleProcessOutput = useCallback(
    (id: string, line: ProcessOutputLine) => {
      dispatch({ type: 'OUTPUT', id, line });
    },
    [],
  );

  const handleProcessExit = useCallback((id: string, code: number | null) => {
    dispatch({ type: 'EXIT', id, code });
  }, []);

  const statusQuery = trpc.process.status.useQuery(
    { id: processId ?? '' },
    { enabled: false },
  );

  const handleReconnect = useCallback(async () => {
    if (!processId || !isProcessRunning(state)) return;

    try {
      const result = await statusQuery.refetch();
      const serverStatus = result.data;

      if (serverStatus) {
        if (serverStatus.state === 'exited') {
          dispatch({
            type: 'RECONCILE',
            serverState: 'exited',
            exitCode: serverStatus.code,
          });
        } else if (serverStatus.state === 'not_found') {
          dispatch({
            type: 'RECONCILE',
            serverState: 'not_found',
          });
        }
      }
    } catch {
      dispatch({ type: 'RECONCILE', serverState: 'not_found' });
    }
  }, [processId, state, statusQuery]);

  const { connectionStatus } = useEventStream({
    project: projectPath,
    topics,
    onProcessReplayStart: handleProcessReplayStart,
    onProcessOutput: handleProcessOutput,
    onProcessExit: handleProcessExit,
    onReconnect: handleReconnect,
  });

  const startMutation = trpc.process.start.useMutation({
    onSuccess: (handle, variables) => {
      const label =
        commands.find((c) => c.cmd === variables.command)?.label ?? 'Command';
      setCommandLabel(label);

      try {
        sessionStorage.removeItem(getStorageKey(handle.id));
      } catch {
        // Storage unavailable
      }

      restoreAttemptedRef.current = handle.id;
      dispatch({ type: 'STARTED', id: handle.id, pid: handle.pid });
      setIsCollapsed(false);

      toast({
        title: `Running: ${label}`,
        description: `Process started (PID: ${handle.pid})`,
      });
    },
    onError: (error) => {
      dispatch({ type: 'ERROR', message: error.message });
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

  const prevExitCodeRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (isCompleted(state) && prevExitCodeRef.current === undefined) {
      const code = state.exitCode;

      queueMicrotask(() => {
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
      });
    }
    prevExitCodeRef.current = isCompleted(state) ? state.exitCode : undefined;
  }, [state, toast]);

  const isRunning = isProcessRunning(state);
  const starting = isStarting(state);
  const completed = isCompleted(state);
  const isStopping = killMutation.isPending;

  const handleRunCommand = (command: CommandConfig) => {
    if (isRunning || starting) return;
    if (command.destructive) {
      setConfirmCommand(command);
    } else {
      dispatch({ type: 'START', command: command.cmd });
      startMutation.mutate({ command: command.cmd });
    }
  };

  const handleConfirmRun = () => {
    if (confirmCommand) {
      dispatch({ type: 'START', command: confirmCommand.cmd });
      startMutation.mutate({ command: confirmCommand.cmd });
      setConfirmCommand(null);
    }
  };

  const handleStop = () => {
    if (!processId || isStopping) return;
    killMutation.mutate({ id: processId });
  };

  const handleClearOutput = () => {
    dispatch({ type: 'RESET' });
    setCommandLabel(null);
  };

  const handleAttach = (id: string, pid: number) => {
    if (isRunning || starting) return;
    setCommandLabel('Attached Process');
    dispatch({ type: 'ATTACH', id, pid });
    setIsCollapsed(false);
    toast({
      title: 'Following process',
      description: `Attached to process PID: ${pid}`,
    });
  };

  const buttonsDisabled = isRunning || starting;
  const stopDisabled = !isRunning || isStopping;

  const getStatusText = () => {
    if (starting) return 'Starting...';
    if (isRunning && commandLabel) {
      return commandLabel === 'Attached Process'
        ? 'Following...'
        : `Running: ${commandLabel}...`;
    }
    if (completed) {
      return exitCode === 0 ? 'Completed' : `Failed (code ${exitCode})`;
    }
    return null;
  };

  const statusText = getStatusText();
  const hasOutput = lines.length > 0 || completed;

  return (
    <>
      <aside
        className={cn(
          'flex flex-col border-l bg-background transition-all duration-200',
          isCollapsed ? 'w-12' : 'w-[350px]',
        )}
      >
        <div className="flex items-center justify-between border-b p-2">
          {!isCollapsed && (
            <span className="text-sm font-medium">Ralph Controls</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', isCollapsed && 'mx-auto')}
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
          >
            {isCollapsed ? '«' : '»'}
          </Button>
        </div>

        {isCollapsed && (
          <div className="flex flex-1 flex-col items-center gap-2 p-2">
            {isRunning && (
              <div
                className="h-3 w-3 animate-pulse rounded-full bg-blue-500"
                title="Process running"
              />
            )}
            {exitCode === 0 && (
              <div
                className="h-3 w-3 rounded-full bg-green-500"
                title="Completed"
              />
            )}
            {exitCode !== null && exitCode !== 0 && (
              <div className="h-3 w-3 rounded-full bg-red-500" title="Failed" />
            )}
          </div>
        )}

        {!isCollapsed && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="space-y-3 border-b p-3">
              <div className="flex flex-wrap gap-2">
                {commands.map((command, index) => {
                  const Icon = getIcon(command.icon);
                  return (
                    <Button
                      key={index}
                      size="sm"
                      variant={command.destructive ? 'destructive' : 'default'}
                      className="flex-1 min-w-[100px]"
                      onClick={() => handleRunCommand(command)}
                      disabled={buttonsDisabled}
                      data-testid={`command-button-${index}`}
                    >
                      <Icon className="mr-1 h-4 w-4" />
                      {starting ? 'Starting...' : command.label}
                    </Button>
                  );
                })}
                {runningProcesses.length > 0 && !buttonsDisabled && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[100px]"
                        data-testid="follow-button"
                      >
                        <Radio className="mr-1 h-4 w-4" />
                        Follow ({runningProcesses.length})
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {runningProcesses.map((proc) => (
                        <DropdownMenuItem
                          key={proc.id}
                          onClick={() => handleAttach(proc.id, proc.pid)}
                        >
                          <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                          PID {proc.pid}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {isRunning && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="w-full"
                  onClick={handleStop}
                  disabled={stopDisabled}
                  data-testid="stop-button"
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
                      exitCode === 0 && 'text-green-600',
                      exitCode !== null && exitCode !== 0 && 'text-destructive',
                    )}
                    data-testid="status-text"
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

              {completed && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearOutput}
                  className="w-full"
                  data-testid="clear-output"
                >
                  Clear
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-hidden p-3">
              {hasOutput || isRunning ? (
                <ProcessOutputViewer
                  lines={lines}
                  exitCode={exitCode}
                  connectionStatus={connectionStatus}
                  processId={processId}
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
      </aside>

      <AlertDialog
        open={confirmCommand !== null}
        onOpenChange={(open) => !open && setConfirmCommand(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run {confirmCommand?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              This command is marked as destructive. Are you sure you want to
              run: <code className="font-mono">{confirmCommand?.cmd}</code>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRun}>
              Run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
