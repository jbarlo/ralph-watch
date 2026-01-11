import { describe, it, expect } from 'vitest';
import {
  TicketSchema,
  TicketsFileSchema,
  CreateTicketSchema,
  UpdateTicketSchema,
} from './schemas';

describe('TicketSchema', () => {
  it('parses a minimal ticket', () => {
    const result = TicketSchema.safeParse({
      id: 1,
      title: 'Test ticket',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(1);
      expect(result.data.title).toBe('Test ticket');
      expect(result.data.status).toBe('pending'); // default
    }
  });

  it('parses a full ticket', () => {
    const result = TicketSchema.safeParse({
      id: 5,
      title: 'Full ticket',
      description: 'A detailed description',
      status: 'in_progress',
      priority: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe(5);
      expect(result.data.title).toBe('Full ticket');
      expect(result.data.description).toBe('A detailed description');
      expect(result.data.status).toBe('in_progress');
      expect(result.data.priority).toBe(3);
    }
  });

  it('allows unknown fields via passthrough', () => {
    const result = TicketSchema.safeParse({
      id: 1,
      title: 'Test',
      customField: 'some value',
      metadata: { foo: 'bar' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).customField).toBe(
        'some value',
      );
      expect((result.data as Record<string, unknown>).metadata).toEqual({
        foo: 'bar',
      });
    }
  });

  it('rejects ticket without id', () => {
    const result = TicketSchema.safeParse({
      title: 'No id ticket',
    });
    expect(result.success).toBe(false);
  });

  it('rejects ticket without title', () => {
    const result = TicketSchema.safeParse({
      id: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe('TicketsFileSchema', () => {
  it('parses a valid tickets file', () => {
    const result = TicketsFileSchema.safeParse({
      tickets: [
        { id: 1, title: 'First' },
        { id: 2, title: 'Second', status: 'completed' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tickets).toHaveLength(2);
    }
  });

  it('parses empty tickets array', () => {
    const result = TicketsFileSchema.safeParse({
      tickets: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tickets).toHaveLength(0);
    }
  });

  it('allows unknown top-level fields', () => {
    const result = TicketsFileSchema.safeParse({
      tickets: [],
      version: '1.0',
      lastUpdated: '2024-01-01',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).version).toBe('1.0');
    }
  });

  it('rejects missing tickets array', () => {
    const result = TicketsFileSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('CreateTicketSchema', () => {
  it('parses minimal create input', () => {
    const result = CreateTicketSchema.safeParse({
      title: 'New ticket',
    });
    expect(result.success).toBe(true);
  });

  it('parses full create input', () => {
    const result = CreateTicketSchema.safeParse({
      title: 'New ticket',
      description: 'Details here',
      priority: 2,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = CreateTicketSchema.safeParse({
      title: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const result = CreateTicketSchema.safeParse({
      description: 'No title provided',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateTicketSchema', () => {
  it('parses empty update (all fields optional)', () => {
    const result = UpdateTicketSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('parses partial update', () => {
    const result = UpdateTicketSchema.safeParse({
      status: 'completed',
    });
    expect(result.success).toBe(true);
  });

  it('parses full update', () => {
    const result = UpdateTicketSchema.safeParse({
      title: 'Updated title',
      description: 'Updated description',
      status: 'in_progress',
      priority: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title in update', () => {
    const result = UpdateTicketSchema.safeParse({
      title: '',
    });
    expect(result.success).toBe(false);
  });
});
