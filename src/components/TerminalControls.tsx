'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TerminalButton } from '@/lib/project-config';

const DEFAULT_BUTTONS: TerminalButton[] = [
  { label: '^C', sequence: '\x03', title: 'Send SIGINT (Ctrl+C)' },
  { label: 'Tab', sequence: '\t', title: 'Send Tab' },
  { label: 'S-Tab', sequence: '\x1b[Z', title: 'Send Shift+Tab (reverse tab)' },
  { label: 'Esc', sequence: '\x1b', title: 'Send Escape' },
  { label: '↑', sequence: '\x1b[A', title: 'Up arrow' },
  { label: '↓', sequence: '\x1b[B', title: 'Down arrow' },
];

interface TerminalControlsProps {
  onSendInput: (data: string) => void;
  disabled?: boolean;
  className?: string;
  buttons?: TerminalButton[];
}

export function TerminalControls({
  onSendInput,
  disabled,
  className,
  buttons = DEFAULT_BUTTONS,
}: TerminalControlsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 border-t bg-background px-2 py-1.5',
        className,
      )}
    >
      {buttons.map(({ label, sequence, title }) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          className="h-8 min-w-[44px] px-2 text-xs font-mono"
          onClick={() => onSendInput(sequence)}
          disabled={disabled}
          title={title}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
