/**
 * Shared UI utilities for ticket display
 */

/**
 * Get badge styling classes based on ticket status.
 * Uses semantic CSS variables defined in globals.css (Catppuccin theme).
 */
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-[hsl(var(--status-draft)/0.2)] text-[hsl(var(--status-draft-foreground))] border-[hsl(var(--status-draft)/0.3)]';
    case 'pending':
      return 'bg-[hsl(var(--status-pending)/0.2)] text-[hsl(var(--status-pending-foreground))] border-[hsl(var(--status-pending)/0.3)]';
    case 'in_progress':
      return 'bg-[hsl(var(--status-in-progress)/0.2)] text-[hsl(var(--status-in-progress-foreground))] border-[hsl(var(--status-in-progress)/0.3)]';
    case 'completed':
      return 'bg-[hsl(var(--status-completed)/0.2)] text-[hsl(var(--status-completed-foreground))] border-[hsl(var(--status-completed)/0.3)]';
    case 'failed':
      return 'bg-[hsl(var(--status-failed)/0.2)] text-[hsl(var(--status-failed-foreground))] border-[hsl(var(--status-failed)/0.3)]';
    default:
      return 'bg-[hsl(var(--status-draft)/0.2)] text-[hsl(var(--status-draft-foreground))] border-[hsl(var(--status-draft)/0.3)]';
  }
}

/**
 * Format status for display (replaces underscores with spaces)
 */
export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}
