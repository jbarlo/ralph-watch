'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function RalphControls() {
  const { toast } = useToast();

  const runOnceMutation = trpc.ralph.runOnce.useMutation({
    onSuccess: () => {
      toast({
        title: 'Running next ticket',
        description: 'ralph-once has been started. Watch for file changes.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start ralph-once',
        variant: 'destructive',
      });
    },
  });

  const runAllMutation = trpc.ralph.runAll.useMutation({
    onSuccess: () => {
      toast({
        title: 'Running all tickets',
        description: 'ralph loop has been started. Watch for file changes.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to start ralph',
        variant: 'destructive',
      });
    },
  });

  const isLoading = runOnceMutation.isPending || runAllMutation.isPending;

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={() => runOnceMutation.mutate()}
        disabled={isLoading}
      >
        {runOnceMutation.isPending ? 'Starting...' : 'Run Next Ticket'}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => runAllMutation.mutate()}
        disabled={isLoading}
      >
        {runAllMutation.isPending ? 'Starting...' : 'Run All'}
      </Button>
    </div>
  );
}
