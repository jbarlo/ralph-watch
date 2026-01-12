'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ProcessOutputViewer } from '@/components/ProcessOutputViewer';
import { useEventStream } from '@/hooks/use-event-stream';
import { useProjectPath } from '@/components/providers/TRPCProvider';
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

interface RunningProcess {
  id: string;
  label: string;
}

export function RalphSidePanel() {
  const { toast } = useToast();
  const projectPath = useProjectPath();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [runningProcess, setRunningProcess] = useState<RunningProcess | null>(
    null,
  );
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);
  const [lines, setLines] = useState<ProcessOutputLine[]>([]);
  const [processExitCode, setProcessExitCode] = useState<number | null>(null);
  const [confirmCommand, setConfirmCommand] = useState<CommandConfig | null>(
    null,
  );

  const configQuery = trpc.config.get.useQuery();
  const commands = configQuery.data?.commands ?? [];

  const getStorageKey = useCallback(
    (processId: string) => `ralph-output-${processId}`,
    [],
  );

  useEffect(() => {
    if (!runningProcess || lines.length === 0) return;

    const key = getStorageKey(runningProcess.id);
    try {
      sessionStorage.setItem(key, JSON.stringify(lines));
    } catch {
      // Storage full or unavailable
    }
  }, [runningProcess, lines, getStorageKey]);

  const restoreAttemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!runningProcess) {
      restoreAttemptedRef.current = null;
      return;
    }

    if (restoreAttemptedRef.current === runningProcess.id) {
      return;
    }

    restoreAttemptedRef.current = runningProcess.id;
    const key = getStorageKey(runningProcess.id);

    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored) as ProcessOutputLine[];
        if (parsed.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- Restoring persisted data on process reconnect
          setLines(parsed);
        }
      }
    } catch {
      // Invalid data or unavailable
    }
  }, [runningProcess, getStorageKey]);

  const topics = useMemo(() => {
    const t: string[] = [];
    if (runningProcess) {
      t.push(`process:${runningProcess.id}`);
    }
    return t;
  }, [runningProcess]);

  const handleProcessReplayStart = useCallback(
    (processId: string) => {
      if (runningProcess && processId === runningProcess.id) {
        setLines([]);
      }
    },
    [runningProcess],
  );

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
    onProcessReplayStart: handleProcessReplayStart,
    onProcessOutput: handleProcessOutput,
    onProcessExit: handleProcessExit,
  });

  const startMutation = trpc.process.start.useMutation({
    onSuccess: (handle, variables) => {
      const label =
        commands.find((c) => c.cmd === variables.command)?.label ?? 'Command';

      try {
        sessionStorage.removeItem(getStorageKey(handle.id));
      } catch {
        // Storage unavailable
      }

      restoreAttemptedRef.current = handle.id;
      setRunningProcess({ id: handle.id, label });
      setLastExitCode(null);
      setLines([]);
      setProcessExitCode(null);
      setIsCollapsed(false);

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

  const handleRunCommand = (command: CommandConfig) => {
    if (isRunning || isStarting) return;
    if (command.destructive) {
      setConfirmCommand(command);
    } else {
      startMutation.mutate({ command: command.cmd });
    }
  };

  const handleConfirmRun = () => {
    if (confirmCommand) {
      startMutation.mutate({ command: confirmCommand.cmd });
      setConfirmCommand(null);
    }
  };

  const handleStop = () => {
    if (!runningProcess || isStopping) return;
    killMutation.mutate({ id: runningProcess.id });
  };

  const handleClearOutput = () => {
    setLastExitCode(null);
    setLines([]);
  };

  const buttonsDisabled = isRunning || isStarting;
  const stopDisabled = !isRunning || isStopping;

  const getStatusText = () => {
    if (isStarting) return 'Starting...';
    if (isRunning) {
      return `Running: ${runningProcess.label}...`;
    }
    if (lastExitCode !== null) {
      return lastExitCode === 0 ? 'Completed' : `Failed (code ${lastExitCode})`;
    }
    return null;
  };

  const statusText = getStatusText();
  const hasOutput = lines.length > 0 || lastExitCode !== null;

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
            {lastExitCode === 0 && (
              <div
                className="h-3 w-3 rounded-full bg-green-500"
                title="Completed"
              />
            )}
            {lastExitCode !== null && lastExitCode !== 0 && (
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
                      {isStarting ? 'Starting...' : command.label}
                    </Button>
                  );
                })}
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
                      lastExitCode === 0 && 'text-green-600',
                      lastExitCode !== null &&
                        lastExitCode !== 0 &&
                        'text-destructive',
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

              {!isRunning && lastExitCode !== null && (
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
