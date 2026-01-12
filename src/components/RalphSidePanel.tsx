'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ProcessOutputViewer } from '@/components/ProcessOutputViewer';
import { useProcessOutput } from '@/hooks/use-process-output';
import { cn } from '@/lib/utils';

/**
 * Type of ralph command being run
 */
type CommandType = 'runOnce' | 'runAll';

/**
 * Running process state
 */
interface RunningProcess {
  id: string;
  commandType: CommandType;
}

/**
 * Persistent side panel for ralph controls and real-time output streaming.
 * Contains:
 * 1) Run Next Ticket and Run All buttons always visible at top
 * 2) Stop/Cancel button when process is running
 * 3) ProcessOutputViewer showing real-time output
 * 4) Collapsible panel design
 */
export function RalphSidePanel() {
  const { toast } = useToast();

  // Panel collapsed state
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Currently running process (only one at a time)
  const [runningProcess, setRunningProcess] = useState<RunningProcess | null>(
    null,
  );
  // Track last exit code for display after process completes
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);

  // Subscribe to process output
  const { exitCode, connectionStatus, lines } = useProcessOutput(
    runningProcess?.id ?? null,
  );

  // Start process mutation
  const startMutation = trpc.process.start.useMutation({
    onSuccess: (handle, variables) => {
      // Determine command type from command string
      const commandType: CommandType = variables.command.includes('ralph-once')
        ? 'runOnce'
        : 'runAll';

      setRunningProcess({ id: handle.id, commandType });
      setLastExitCode(null);
      // Auto-expand panel when running
      setIsCollapsed(false);

      toast({
        title:
          commandType === 'runOnce'
            ? 'Running next ticket'
            : 'Running all tickets',
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

  // Kill process mutation
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

  // Track the previous exit code to detect changes
  const prevExitCodeRef = useRef<number | null>(null);

  // Handle process exit callback
  const handleProcessExit = useCallback(
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

  // Detect exit code changes and trigger handler
  useEffect(() => {
    if (
      runningProcess &&
      exitCode !== null &&
      prevExitCodeRef.current === null
    ) {
      queueMicrotask(() => handleProcessExit(exitCode));
    }
    prevExitCodeRef.current = exitCode;
  }, [runningProcess, exitCode, handleProcessExit]);

  const isRunning = runningProcess !== null && exitCode === null;
  const isStarting = startMutation.isPending;
  const isStopping = killMutation.isPending;

  const handleRunOnce = () => {
    if (isRunning || isStarting) return;
    startMutation.mutate({ command: 'ralph-once' });
  };

  const handleRunAll = () => {
    if (isRunning || isStarting) return;
    startMutation.mutate({ command: 'ralph' });
  };

  const handleStop = () => {
    if (!runningProcess || isStopping) return;
    killMutation.mutate({ id: runningProcess.id });
  };

  const handleClearOutput = () => {
    setLastExitCode(null);
  };

  // Compute button states
  const runOnceDisabled = isRunning || isStarting;
  const runAllDisabled = isRunning || isStarting;
  const stopDisabled = !isRunning || isStopping;

  // Status text
  const getStatusText = () => {
    if (isStarting) return 'Starting...';
    if (isRunning) {
      return runningProcess.commandType === 'runOnce'
        ? 'Running next ticket...'
        : 'Running all tickets...';
    }
    if (lastExitCode !== null) {
      return lastExitCode === 0 ? 'Completed' : `Failed (code ${lastExitCode})`;
    }
    return null;
  };

  const statusText = getStatusText();
  const hasOutput = lines.length > 0 || lastExitCode !== null;

  return (
    <aside
      className={cn(
        'flex flex-col border-l bg-background transition-all duration-200',
        isCollapsed ? 'w-12' : 'w-[350px]',
      )}
    >
      {/* Collapse toggle */}
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

      {/* Collapsed view: just show running indicator */}
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

      {/* Expanded view */}
      {!isCollapsed && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Control buttons */}
          <div className="space-y-3 border-b p-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleRunOnce}
                disabled={runOnceDisabled}
                data-testid="run-once-button"
              >
                {isStarting ? 'Starting...' : 'Run Next Ticket'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={handleRunAll}
                disabled={runAllDisabled}
                data-testid="run-all-button"
              >
                {isStarting ? 'Starting...' : 'Run All'}
              </Button>
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

            {/* Status indicator */}
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

            {/* Clear button */}
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

          {/* Output viewer */}
          <div className="flex-1 overflow-hidden p-3">
            {hasOutput || isRunning ? (
              <ProcessOutputViewer
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
  );
}
