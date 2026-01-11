/**
 * Integration tests for process output streaming SSE endpoint.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET, setRunner } from './route';
import { createProcessRunner } from '@/server/services/process-runner';
import { isOk } from '@/lib/result';

// Store test runner for each test
let testRunner: ReturnType<typeof createProcessRunner>;

describe('Process stream SSE endpoint', () => {
  beforeEach(() => {
    testRunner = createProcessRunner();
    setRunner(testRunner);
  });

  afterEach(() => {
    setRunner(null);
  });

  it('returns 404 for unknown process', async () => {
    const request = new Request(
      'http://localhost:3000/api/process/unknown-id/stream',
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: 'unknown-id' }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Process not found');
  });

  it('returns SSE stream with connected event', async () => {
    // Start a process that will run for a bit
    const result = await testRunner.start({ command: 'sleep 5', cwd: '/tmp' });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const processId = result.value.id;
    const request = new Request(
      `http://localhost:3000/api/process/${processId}/stream`,
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: processId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    // Read the first event
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const { value, done } = await reader.read();
    expect(done).toBe(false);

    const text = decoder.decode(value);
    expect(text).toContain('event: connected');
    expect(text).toContain(`"id":"${processId}"`);

    // Cleanup
    await reader.cancel();
    await testRunner.kill(processId);
  });

  it('streams output events from process', async () => {
    // Start a process that outputs something
    const result = await testRunner.start({
      command: 'echo hello && echo world',
      cwd: '/tmp',
    });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const processId = result.value.id;

    // Wait a bit for output to be captured
    await new Promise((resolve) => setTimeout(resolve, 200));

    const request = new Request(
      `http://localhost:3000/api/process/${processId}/stream`,
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: processId }),
    });

    expect(response.status).toBe(200);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Collect events
    const events: string[] = [];
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      const result = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), 100),
        ),
      ]);

      if (result.done || !result.value) {
        break;
      }

      const text = decoder.decode(result.value);
      events.push(text);

      // Check if we got exit event
      if (text.includes('event: exit')) {
        break;
      }

      attempts++;
    }

    // Should have connected event
    const allText = events.join('');
    expect(allText).toContain('event: connected');

    // Should have output events with hello and world
    expect(allText).toContain('event: output');
    expect(allText).toContain('hello');
    expect(allText).toContain('world');

    // Cleanup
    await reader.cancel();
  });

  it('sends exit event when process completes', async () => {
    // Start a fast process
    const result = await testRunner.start({
      command: 'echo done',
      cwd: '/tmp',
    });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const processId = result.value.id;

    // Wait for process to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    const request = new Request(
      `http://localhost:3000/api/process/${processId}/stream`,
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: processId }),
    });

    expect(response.status).toBe(200);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Collect all events
    const events: string[] = [];
    let attempts = 0;
    const maxAttempts = 20;

    while (attempts < maxAttempts) {
      const result = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), 200),
        ),
      ]);

      if (result.done || !result.value) {
        break;
      }

      const text = decoder.decode(result.value);
      events.push(text);
      attempts++;
    }

    const allText = events.join('');

    // Should have exit event with code
    expect(allText).toContain('event: exit');
    expect(allText).toContain('"code":0');

    await reader.cancel();
  });

  it('sends exit event for already-exited process', async () => {
    // Start a fast process that exits immediately
    const result = await testRunner.start({ command: 'true', cwd: '/tmp' });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const processId = result.value.id;

    // Wait for it to exit
    await new Promise((resolve) => setTimeout(resolve, 300));

    const request = new Request(
      `http://localhost:3000/api/process/${processId}/stream`,
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: processId }),
    });

    expect(response.status).toBe(200);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read all available data
    let allText = '';
    let attempts = 0;

    while (attempts < 10) {
      const result = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), 100),
        ),
      ]);

      if (result.done || !result.value) {
        break;
      }

      allText += decoder.decode(result.value);
      attempts++;
    }

    // Should have both connected and exit
    expect(allText).toContain('event: connected');
    expect(allText).toContain('event: exit');
    expect(allText).toContain('"code":0');

    await reader.cancel();
  });

  it('captures stderr output', async () => {
    // Start a process that outputs to stderr
    const result = await testRunner.start({
      command: 'echo error >&2',
      cwd: '/tmp',
    });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;

    const processId = result.value.id;

    // Wait for output
    await new Promise((resolve) => setTimeout(resolve, 300));

    const request = new Request(
      `http://localhost:3000/api/process/${processId}/stream`,
    );
    const response = await GET(request, {
      params: Promise.resolve({ id: processId }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let allText = '';
    let attempts = 0;

    while (attempts < 20) {
      const result = await Promise.race([
        reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), 100),
        ),
      ]);

      if (result.done || !result.value) {
        break;
      }

      allText += decoder.decode(result.value);
      if (allText.includes('event: exit')) break;
      attempts++;
    }

    // Should have stderr output
    expect(allText).toContain('event: output');
    expect(allText).toContain('"stream":"stderr"');
    expect(allText).toContain('error');

    await reader.cancel();
  });
});
