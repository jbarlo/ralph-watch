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

export interface RiffTicketContext {
  id: number;
  title: string;
  status: string;
  priority?: number;
  description?: string;
}

export interface RiffOnTicketEventDetail {
  ticketId: number;
  label: string;
  context: string;
}

/**
 * Dispatch a riff-on-ticket event to open a Claude terminal session with ticket context.
 */
export function dispatchRiffOnTicket(ticket: RiffTicketContext): void {
  const detail: RiffOnTicketEventDetail = {
    ticketId: ticket.id,
    label: `Ticket #${ticket.id}`,
    context: formatTicketContext(ticket),
  };
  window.dispatchEvent(new CustomEvent('riff-on-ticket', { detail }));
}

/**
 * Format ticket context for Claude terminal session.
 * Creates a prompt string that provides Claude with ticket context.
 */
export function formatTicketContext(ticket: RiffTicketContext): string {
  return `I want to discuss this ticket with you:

Ticket #${ticket.id}: ${ticket.title}
Status: ${ticket.status}
Priority: ${ticket.priority ?? 'none'}

Description:
${ticket.description ?? '(no description)'}

Help me think through this task.`;
}
