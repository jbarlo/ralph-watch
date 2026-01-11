import { z } from 'zod';

/**
 * Ticket status values
 */
export const ticketStatuses = [
  'pending',
  'in_progress',
  'completed',
  'failed',
] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

/**
 * Loose Zod schema for a single ticket.
 * Uses passthrough() to allow unknown fields for forward compatibility.
 */
export const TicketSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    description: z.string().optional(),
    status: z.string().default('pending'),
    priority: z.number().optional(),
  })
  .passthrough();

export type Ticket = z.infer<typeof TicketSchema>;

/**
 * Loose Zod schema for the tickets.json file structure.
 * Uses passthrough() to allow unknown top-level fields.
 */
export const TicketsFileSchema = z
  .object({
    tickets: z.array(TicketSchema),
  })
  .passthrough();

export type TicketsFile = z.infer<typeof TicketsFileSchema>;

/**
 * Schema for creating a new ticket (id is auto-generated)
 */
export const CreateTicketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.number().optional(),
});

export type CreateTicket = z.infer<typeof CreateTicketSchema>;

/**
 * Schema for updating an existing ticket (all fields optional)
 */
export const UpdateTicketSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.number().optional(),
});

export type UpdateTicket = z.infer<typeof UpdateTicketSchema>;
