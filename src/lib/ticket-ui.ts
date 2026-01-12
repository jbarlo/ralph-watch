/**
 * Shared UI utilities for ticket display
 */

/**
 * Get badge styling classes based on ticket status.
 * Uses semantic CSS variables defined in globals.css (Catppuccin theme).
 * Background is the semantic color, foreground is readable text.
 */
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-[hsl(var(--status-draft-bg))] text-[hsl(var(--status-draft-fg))] border-[hsl(var(--status-draft-bg))]';
    case 'pending':
      return 'bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending-fg))] border-[hsl(var(--status-pending-bg))]';
    case 'in_progress':
      return 'bg-[hsl(var(--status-in-progress-bg))] text-[hsl(var(--status-in-progress-fg))] border-[hsl(var(--status-in-progress-bg))]';
    case 'completed':
      return 'bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed-fg))] border-[hsl(var(--status-completed-bg))]';
    case 'failed':
      return 'bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-fg))] border-[hsl(var(--status-failed-bg))]';
    default:
      return 'bg-[hsl(var(--status-draft-bg))] text-[hsl(var(--status-draft-fg))] border-[hsl(var(--status-draft-bg))]';
  }
}

/**
 * Format status for display (replaces underscores with spaces)
 */
export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}
