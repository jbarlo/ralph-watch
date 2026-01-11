import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { ticketsRouter } from './tickets';
import type { Context } from '../trpc';
import type { TicketsFile } from '@/lib/schemas';

const TEST_DIR = join(process.cwd(), '.test-tickets');
const TICKETS_FILE = join(TEST_DIR, 'tickets.json');

/**
 * Create a test caller with context pointing to test directory
 */
function createTestCaller() {
  const ctx: Context = {
    ralphDir: TEST_DIR,
  };
  return ticketsRouter.createCaller(ctx);
}

/**
 * Write test tickets file
 */
async function writeTestTickets(data: TicketsFile) {
  await writeFile(TICKETS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Read test tickets file
 */
async function readTestTickets(): Promise<TicketsFile> {
  const content = await readFile(TICKETS_FILE, 'utf-8');
  return JSON.parse(content) as TicketsFile;
}

describe('tickets router', () => {
  beforeEach(async () => {
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });
    // Create empty tickets file
    await writeTestTickets({ tickets: [] });
  });

  afterEach(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('list', () => {
    it('returns empty array when no tickets', async () => {
      const caller = createTestCaller();
      const tickets = await caller.list();
      expect(tickets).toEqual([]);
    });

    it('returns all tickets', async () => {
      await writeTestTickets({
        tickets: [
          { id: 1, title: 'First', status: 'pending' },
          { id: 2, title: 'Second', status: 'completed' },
        ],
      });

      const caller = createTestCaller();
      const tickets = await caller.list();

      expect(tickets).toHaveLength(2);
      expect(tickets[0]?.title).toBe('First');
      expect(tickets[1]?.title).toBe('Second');
    });
  });

  describe('get', () => {
    it('returns a ticket by id', async () => {
      await writeTestTickets({
        tickets: [
          { id: 1, title: 'First', status: 'pending' },
          { id: 5, title: 'Fifth', status: 'in_progress', priority: 2 },
        ],
      });

      const caller = createTestCaller();
      const ticket = await caller.get({ id: 5 });

      expect(ticket.id).toBe(5);
      expect(ticket.title).toBe('Fifth');
      expect(ticket.status).toBe('in_progress');
      expect(ticket.priority).toBe(2);
    });

    it('throws error for non-existent ticket', async () => {
      await writeTestTickets({
        tickets: [{ id: 1, title: 'First', status: 'pending' }],
      });

      const caller = createTestCaller();
      await expect(caller.get({ id: 999 })).rejects.toThrow(
        'Ticket with id 999 not found',
      );
    });
  });

  describe('create', () => {
    it('creates a ticket with minimal fields', async () => {
      const caller = createTestCaller();
      const ticket = await caller.create({ title: 'New ticket' });

      expect(ticket.id).toBe(1);
      expect(ticket.title).toBe('New ticket');
      expect(ticket.status).toBe('pending');
      expect(ticket.description).toBeUndefined();
      expect(ticket.priority).toBeUndefined();

      // Verify persisted
      const data = await readTestTickets();
      expect(data.tickets).toHaveLength(1);
      expect(data.tickets[0]?.title).toBe('New ticket');
    });

    it('creates a ticket with all fields', async () => {
      const caller = createTestCaller();
      const ticket = await caller.create({
        title: 'Full ticket',
        description: 'A detailed description',
        priority: 3,
      });

      expect(ticket.id).toBe(1);
      expect(ticket.title).toBe('Full ticket');
      expect(ticket.description).toBe('A detailed description');
      expect(ticket.priority).toBe(3);
      expect(ticket.status).toBe('pending');
    });

    it('assigns incrementing ids', async () => {
      await writeTestTickets({
        tickets: [
          { id: 1, title: 'First', status: 'pending' },
          { id: 10, title: 'Tenth', status: 'pending' },
        ],
      });

      const caller = createTestCaller();
      const ticket = await caller.create({ title: 'New ticket' });

      expect(ticket.id).toBe(11);
    });
  });

  describe('update', () => {
    it('updates a ticket partially', async () => {
      await writeTestTickets({
        tickets: [{ id: 1, title: 'Original', status: 'pending', priority: 1 }],
      });

      const caller = createTestCaller();
      const ticket = await caller.update({
        id: 1,
        data: { status: 'in_progress' },
      });

      expect(ticket.title).toBe('Original'); // unchanged
      expect(ticket.status).toBe('in_progress'); // updated
      expect(ticket.priority).toBe(1); // unchanged

      // Verify persisted
      const data = await readTestTickets();
      expect(data.tickets[0]?.status).toBe('in_progress');
    });

    it('updates multiple fields', async () => {
      await writeTestTickets({
        tickets: [{ id: 1, title: 'Original', status: 'pending' }],
      });

      const caller = createTestCaller();
      const ticket = await caller.update({
        id: 1,
        data: {
          title: 'Updated',
          description: 'New description',
          status: 'completed',
          priority: 5,
        },
      });

      expect(ticket.title).toBe('Updated');
      expect(ticket.description).toBe('New description');
      expect(ticket.status).toBe('completed');
      expect(ticket.priority).toBe(5);
    });

    it('throws error for non-existent ticket', async () => {
      await writeTestTickets({
        tickets: [{ id: 1, title: 'First', status: 'pending' }],
      });

      const caller = createTestCaller();
      await expect(
        caller.update({ id: 999, data: { title: 'Updated' } }),
      ).rejects.toThrow('Ticket with id 999 not found');
    });
  });

  describe('delete', () => {
    it('deletes a ticket', async () => {
      await writeTestTickets({
        tickets: [
          { id: 1, title: 'First', status: 'pending' },
          { id: 2, title: 'Second', status: 'pending' },
        ],
      });

      const caller = createTestCaller();
      const result = await caller.delete({ id: 1 });

      expect(result.success).toBe(true);
      expect(result.id).toBe(1);

      // Verify persisted
      const data = await readTestTickets();
      expect(data.tickets).toHaveLength(1);
      expect(data.tickets[0]?.id).toBe(2);
    });

    it('throws error for non-existent ticket', async () => {
      await writeTestTickets({
        tickets: [{ id: 1, title: 'First', status: 'pending' }],
      });

      const caller = createTestCaller();
      await expect(caller.delete({ id: 999 })).rejects.toThrow(
        'Ticket with id 999 not found',
      );
    });
  });
});
