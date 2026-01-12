/**
 * Shared UI utilities for ticket display
 */

/**
 * Get badge styling classes based on ticket status
 */
export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'draft':
      return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
    case 'in_progress':
      return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
    case 'completed':
      return 'bg-green-500/20 text-green-700 border-green-500/30';
    case 'failed':
      return 'bg-red-500/20 text-red-700 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
  }
}

/**
 * Format status for display (replaces underscores with spaces)
 */
export function formatStatus(status: string): string {
  return status.replace(/_/g, ' ');
}
