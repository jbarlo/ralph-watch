'use client';

import { cn } from '@/lib/utils';

export type TicketStatus =
  | 'all'
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed';

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

interface TicketFilterProps {
  value: TicketStatus;
  onChange: (status: TicketStatus) => void;
}

export function TicketFilter({ value, onChange }: TicketFilterProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-2 md:py-1.5 text-xs font-medium transition-colors',
            'min-h-[36px] md:min-h-0',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-background/50 hover:text-foreground active:bg-background/70',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function isValidTicketStatus(
  status: string | null,
): status is TicketStatus {
  if (!status) return false;
  return [
    'all',
    'draft',
    'pending',
    'in_progress',
    'completed',
    'failed',
  ].includes(status);
}
