'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ProcessOutputViewer } from '@/components/ProcessOutputViewer';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useProcessOutput } from '@/hooks/use-process-output';
import { cn } from '@/lib/utils';

type CommandType = 'runOnce' | 'runAll';

interface RunningProcess {
  id: string;
  commandType: CommandType;
}

export function RalphControls() {
  const { toast } = useToast();
  const [runningProcess, setRunningProcess] = useState<RunningProcess | null>(
    null,
  );
  const [outputOpen, setOutputOpen] = useState(false);
  const [lastExitCode, setLastExitCode] = useState<number | null>(null);

  const { exitCode, connectionStatus } = useProcessOutput(
    runningProcess?.id ?? null,
  );

  const startMutation = trpc.process.start.useMutation({
    onSuccess: (handle, variables) => {
      const commandType: CommandType = variables.command.includes('ralph-once')
        ? 'runOnce'
        : 'runAll';

      setRunningProcess({ id: handle.id, commandType });
      setOutputOpen(true);
      setLastExitCode(null);

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
    setOutputOpen(false);
  };

  const runOnceDisabled = isRunning || isStarting;
  const runAllDisabled = isRunning || isStarting;
  const stopDisabled = !isRunning || isStopping;

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
  const showOutput = outputOpen || isRunning || statusText !== null;

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center">
        <Button
          size="sm"
          onClick={handleRunOnce}
          disabled={runOnceDisabled}
          data-testid="run-once-button"
        >
          {isStarting ? 'Starting...' : 'Run Next Ticket'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleRunAll}
          disabled={runAllDisabled}
          data-testid="run-all-button"
        >
          {isStarting ? 'Starting...' : 'Run All'}
        </Button>

        {isRunning && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleStop}
            disabled={stopDisabled}
            data-testid="stop-button"
          >
            {isStopping ? 'Stopping...' : 'Stop'}
          </Button>
        )}

        {statusText && (
          <span
            className={cn(
              'text-sm',
              isRunning && 'text-blue-600 animate-pulse',
              lastExitCode === 0 && 'text-green-600',
              lastExitCode !== null && lastExitCode !== 0 && 'text-destructive',
            )}
            data-testid="status-text"
          >
            {statusText}
          </span>
        )}
      </div>

      {showOutput && (
        <Collapsible open={outputOpen} onOpenChange={setOutputOpen}>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="toggle-output">
                {outputOpen ? 'Hide Output' : 'Show Output'}
              </Button>
            </CollapsibleTrigger>
            {!isRunning && lastExitCode !== null && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearOutput}
                data-testid="clear-output"
              >
                Clear
              </Button>
            )}
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
          <CollapsibleContent className="mt-2">
            <ProcessOutputViewer
              processId={runningProcess?.id ?? null}
              height="200px"
              title="Process Output"
              showCard={false}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
