'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TerminalControlsProps {
  onSendInput: (data: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TerminalControls({
  onSendInput,
  disabled,
  className,
}: TerminalControlsProps) {
  const controls = [
    { label: '^C', data: '\x03', title: 'Send SIGINT (Ctrl+C)' },
    { label: 'Tab', data: '\t', title: 'Send Tab' },
    { label: 'Esc', data: '\x1b', title: 'Send Escape' },
    { label: '↑', data: '\x1b[A', title: 'Up arrow' },
    { label: '↓', data: '\x1b[B', title: 'Down arrow' },
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-1 border-t bg-background px-2 py-1.5',
        className,
      )}
    >
      {controls.map(({ label, data, title }) => (
        <Button
          key={label}
          variant="outline"
          size="sm"
          className="h-8 min-w-[44px] px-2 text-xs font-mono"
          onClick={() => onSendInput(data)}
          disabled={disabled}
          title={title}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
