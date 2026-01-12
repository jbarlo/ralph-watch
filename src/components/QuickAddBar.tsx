'use client';

import { useState, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { AddTicketForm } from '@/components/AddTicketForm';
import { cn } from '@/lib/utils';

export interface QuickAddBarProps {
  className?: string;
}

export function QuickAddBar({ className }: QuickAddBarProps) {
  const [title, setTitle] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const createMutation = trpc.tickets.create.useMutation({
    onSuccess: (ticket) => {
      setTitle('');
      utils.tickets.list.invalidate();
      toast({
        title: ticket.status === 'draft' ? 'Draft created' : 'Ticket created',
        description: `"${ticket.title}" added as ${ticket.status}`,
      });
      inputRef.current?.focus();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create ticket',
        variant: 'destructive',
      });
    },
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && title.trim()) {
        e.preventDefault();
        const status = e.shiftKey ? 'pending' : 'draft';
        createMutation.mutate({ title: title.trim(), status });
      }
    },
    [title, createMutation],
  );

  const handleExpandedFormSuccess = useCallback(() => {
    setIsExpanded(false);
    inputRef.current?.focus();
  }, []);

  const [expandedTitle, setExpandedTitle] = useState('');

  const handleExpand = useCallback(() => {
    setExpandedTitle(title);
    setTitle('');
    setIsExpanded(true);
  }, [title]);

  if (isExpanded) {
    return (
      <div
        className={cn(
          'rounded-lg border bg-card p-4 max-h-[50vh] md:max-h-none overflow-y-auto',
          className,
        )}
      >
        <div className="mb-3 flex items-center justify-between sticky top-0 bg-card pb-2 -mt-1 pt-1 z-10">
          <span className="text-sm font-medium">New Ticket</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="h-6 px-2"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
        </div>
        <AddTicketForm
          onSuccess={handleExpandedFormSuccess}
          defaultTitle={expandedTitle}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Quick add (Enter = draft)"
          disabled={createMutation.isPending}
          className="pr-8 h-11 md:h-9 text-base md:text-sm"
        />
        {createMutation.isPending && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={handleExpand}
        title="Expand full form"
        className="h-11 w-11 md:h-9 md:w-9"
      >
        {isExpanded ? (
          <ChevronDown className="h-5 w-5 md:h-4 md:w-4" />
        ) : (
          <Plus className="h-5 w-5 md:h-4 md:w-4" />
        )}
      </Button>
    </div>
  );
}
