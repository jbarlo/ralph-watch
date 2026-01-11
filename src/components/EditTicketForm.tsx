'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import type { Ticket } from '@/lib/schemas';
import { ticketStatuses } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export interface EditTicketFormProps {
  ticket: Ticket;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EditTicketForm({
  ticket,
  onSuccess,
  onCancel,
}: EditTicketFormProps) {
  const [title, setTitle] = useState(ticket.title);
  const [description, setDescription] = useState(ticket.description ?? '');
  const [priority, setPriority] = useState<number>(ticket.priority ?? 1);
  const [status, setStatus] = useState(ticket.status);

  const { toast } = useToast();
  const utils = trpc.useUtils();

  const updateMutation = trpc.tickets.update.useMutation({
    onSuccess: () => {
      // Invalidate tickets query to refetch
      utils.tickets.list.invalidate();

      // Show success toast
      toast({
        title: 'Ticket updated',
        description: 'Your changes have been saved.',
      });

      // Call onSuccess callback if provided
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update ticket',
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

    updateMutation.mutate({
      id: ticket.id,
      data: {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="edit-title" className="text-sm font-medium">
          Title <span className="text-destructive">*</span>
        </label>
        <Input
          id="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter ticket title"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="edit-description" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="edit-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter ticket description (optional)"
          rows={3}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="edit-priority" className="text-sm font-medium">
          Priority
        </label>
        <Input
          id="edit-priority"
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

      <div className="flex flex-col gap-2">
        <label htmlFor="edit-status" className="text-sm font-medium">
          Status
        </label>
        <select
          id="edit-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ticketStatuses.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="flex-1"
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}
