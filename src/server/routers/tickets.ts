import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';
import { router, publicProcedure, getRalphFilePath } from '../trpc';
import {
  TicketsFileSchema,
  CreateTicketSchema,
  UpdateTicketSchema,
  type TicketsFile,
  type Ticket,
} from '@/lib/schemas';
import { ok, err, isErr, tryCatchAsync, type Result } from '@/lib/result';

/**
 * Read and parse tickets.json
 */
async function readTicketsFile(): Promise<Result<TicketsFile, string>> {
  const filePath = getRalphFilePath('tickets.json');

  const readResult = await tryCatchAsync(async () => {
    const content = await readFile(filePath, 'utf-8');
    return content;
  });

  if (isErr(readResult)) {
    return err(`Failed to read tickets.json: ${readResult.error}`);
  }

  try {
    const parsed = JSON.parse(readResult.value) as unknown;
    const validated = TicketsFileSchema.parse(parsed);
    return ok(validated);
  } catch (e) {
    return err(`Failed to parse tickets.json: ${e}`);
  }
}

/**
 * Write tickets data back to tickets.json
 */
async function writeTicketsFile(
  data: TicketsFile,
): Promise<Result<void, string>> {
  const filePath = getRalphFilePath('tickets.json');

  const writeResult = await tryCatchAsync(async () => {
    await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  });

  if (isErr(writeResult)) {
    return err(`Failed to write tickets.json: ${writeResult.error}`);
  }

  return ok(undefined);
}

/**
 * Get the next available ticket ID
 */
function getNextId(tickets: Ticket[]): number {
  if (tickets.length === 0) {
    return 1;
  }
  const maxId = Math.max(...tickets.map((t) => t.id));
  return maxId + 1;
}

/**
 * tRPC router for tickets CRUD operations
 */
export const ticketsRouter = router({
  /**
   * List all tickets
   */
  list: publicProcedure.query(async () => {
    const result = await readTicketsFile();
    if (isErr(result)) {
      throw new Error(result.error);
    }
    return result.value.tickets;
  }),

  /**
   * Get a single ticket by ID
   */
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async (opts) => {
      const result = await readTicketsFile();
      if (isErr(result)) {
        throw new Error(result.error);
      }

      const ticket = result.value.tickets.find((t) => t.id === opts.input.id);
      if (!ticket) {
        throw new Error(`Ticket with id ${opts.input.id} not found`);
      }

      return ticket;
    }),

  /**
   * Create a new ticket
   */
  create: publicProcedure.input(CreateTicketSchema).mutation(async (opts) => {
    const result = await readTicketsFile();
    if (isErr(result)) {
      throw new Error(result.error);
    }

    const data = result.value;
    const newTicket: Ticket = {
      id: getNextId(data.tickets),
      title: opts.input.title,
      description: opts.input.description,
      status: 'pending',
      priority: opts.input.priority,
    };

    data.tickets.push(newTicket);

    const writeResult = await writeTicketsFile(data);
    if (isErr(writeResult)) {
      throw new Error(writeResult.error);
    }

    return newTicket;
  }),

  /**
   * Update an existing ticket
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        data: UpdateTicketSchema,
      }),
    )
    .mutation(async (opts) => {
      const result = await readTicketsFile();
      if (isErr(result)) {
        throw new Error(result.error);
      }

      const data = result.value;
      const ticketIndex = data.tickets.findIndex((t) => t.id === opts.input.id);
      if (ticketIndex === -1) {
        throw new Error(`Ticket with id ${opts.input.id} not found`);
      }

      const existingTicket = data.tickets[ticketIndex];
      if (!existingTicket) {
        throw new Error(`Ticket with id ${opts.input.id} not found`);
      }

      // Merge updates with existing ticket
      const updatedTicket: Ticket = {
        ...existingTicket,
        ...opts.input.data,
      };

      data.tickets[ticketIndex] = updatedTicket;

      const writeResult = await writeTicketsFile(data);
      if (isErr(writeResult)) {
        throw new Error(writeResult.error);
      }

      return updatedTicket;
    }),

  /**
   * Delete a ticket
   */
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async (opts) => {
      const result = await readTicketsFile();
      if (isErr(result)) {
        throw new Error(result.error);
      }

      const data = result.value;
      const ticketIndex = data.tickets.findIndex((t) => t.id === opts.input.id);
      if (ticketIndex === -1) {
        throw new Error(`Ticket with id ${opts.input.id} not found`);
      }

      data.tickets.splice(ticketIndex, 1);

      const writeResult = await writeTicketsFile(data);
      if (isErr(writeResult)) {
        throw new Error(writeResult.error);
      }

      return { success: true, id: opts.input.id };
    }),
});
