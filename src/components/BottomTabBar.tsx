'use client';

import { ClipboardList, FileText, Play, Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTab = 'tickets' | 'progress' | 'run' | 'terminal';

interface BottomTabBarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  isProcessRunning?: boolean;
  isTerminalConnected?: boolean;
}

const tabs: { id: MobileTab; label: string; Icon: typeof ClipboardList }[] = [
  { id: 'tickets', label: 'Tickets', Icon: ClipboardList },
  { id: 'progress', label: 'Progress', Icon: FileText },
  { id: 'run', label: 'Run', Icon: Play },
  { id: 'terminal', label: 'Terminal', Icon: Terminal },
];

export function BottomTabBar({
  activeTab,
  onTabChange,
  isProcessRunning,
  isTerminalConnected,
}: BottomTabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden">
      <div className="flex h-16 items-stretch">
        {tabs.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          const showRunningIndicator = id === 'run' && isProcessRunning;
          const showTerminalIndicator =
            id === 'terminal' && isTerminalConnected;

          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors',
                'min-h-[56px]',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <div className="relative">
                <Icon className="h-5 w-5" />
                {showRunningIndicator && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                )}
                {showTerminalIndicator && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-green-500" />
                )}
              </div>
              <span className="text-xs font-medium">{label}</span>
              {isActive && (
                <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
