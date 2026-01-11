'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export interface AddTicketFormProps {
  onSuccess?: () => void;
}

export function AddTicketForm({ onSuccess }: AddTicketFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<number>(1);

  const { toast } = useToast();
  const utils = trpc.useUtils();

  const createMutation = trpc.tickets.create.useMutation({
    onSuccess: () => {
      // Clear form
      setTitle('');
      setDescription('');
      setPriority(1);

      // Invalidate tickets query to refetch
      utils.tickets.list.invalidate();

      // Show success toast
      toast({
        title: 'Ticket created',
        description: 'Your ticket has been created successfully.',
      });

      // Call onSuccess callback if provided
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create ticket',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({
        title: 'Validation error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="title" className="text-sm font-medium">
          Title <span className="text-destructive">*</span>
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter ticket title"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter ticket description (optional)"
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="priority" className="text-sm font-medium">
          Priority
        </label>
        <Input
          id="priority"
          type="number"
          min={1}
          value={priority}
          onChange={(e) => setPriority(Number(e.target.value) || 1)}
          placeholder="1"
        />
        <p className="text-xs text-muted-foreground">
          Lower numbers indicate higher priority
        </p>
      </div>

      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
      </Button>
    </form>
  );
}
