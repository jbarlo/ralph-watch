import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProcessOutput } from './use-process-output';
import type { ProcessOutputLine } from '@/lib/process-runner';

// Mock EventSource for testing
class MockEventSource {
  url: string;
  readyState: number = 0;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  private listeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockEventSource.OPEN;
    }, 0);
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)?.push(handler);
  }

  removeEventListener(
    type: string,
    handler: (event: MessageEvent) => void,
  ): void {
    const handlers = this.listeners.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  // Test helper to emit events
  _emit(type: string, data: unknown): void {
    const event = new MessageEvent(type, {
      data: JSON.stringify(data),
    });
    const handlers = this.listeners.get(type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  // Test helper to trigger error
  _triggerError(): void {
    if (this.onerror) {
      this.onerror();
    }
  }
}

// Store reference to mock instances for test manipulation
let mockEventSourceInstances: MockEventSource[] = [];

// Replace global EventSource with mock
const originalEventSource = globalThis.EventSource;

describe('useProcessOutput', () => {
  beforeEach(() => {
    mockEventSourceInstances = [];
    // @ts-expect-error - replacing global EventSource with mock
    globalThis.EventSource = class extends MockEventSource {
      constructor(url: string) {
        super(url);
        mockEventSourceInstances.push(this);
      }
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
  });

  it('should render without throwing errors', () => {
    expect(() => {
      const { result } = renderHook(() => useProcessOutput('test-id'));
      expect(result.current).toBeDefined();
    }).not.toThrow();
  });

  it('should start in disconnected state with null processId', () => {
    const { result } = renderHook(() => useProcessOutput(null));

    expect(result.current.lines).toEqual([]);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.exitCode).toBeNull();
    expect(result.current.connectionStatus).toBe('disconnected');
  });

  it('should start in connecting state when processId provided', () => {
    const { result } = renderHook(() => useProcessOutput('test-id'));

    expect(result.current.connectionStatus).toBe('connecting');
    expect(result.current.isConnected).toBe(false);
  });

  it('should connect to correct SSE endpoint', () => {
    renderHook(() => useProcessOutput('my-process-123'));

    expect(mockEventSourceInstances.length).toBe(1);
    expect(mockEventSourceInstances[0]?.url).toBe(
      '/api/process/my-process-123/stream',
    );
  });

  it('should URL-encode processId in endpoint', () => {
    renderHook(() => useProcessOutput('id with spaces'));

    expect(mockEventSourceInstances[0]?.url).toBe(
      '/api/process/id%20with%20spaces/stream',
    );
  });

  it('should transition to connected on connected event', async () => {
    const { result } = renderHook(() => useProcessOutput('test-id'));

    await act(async () => {
      mockEventSourceInstances[0]?._emit('connected', {
        id: 'test-id',
        timestamp: Date.now(),
      });
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('connected');
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should accumulate output lines', async () => {
    const { result } = renderHook(() => useProcessOutput('test-id'));

    const line1: ProcessOutputLine = {
      stream: 'stdout',
      line: 'Hello',
      timestamp: 1000,
    };
    const line2: ProcessOutputLine = {
      stream: 'stderr',
      line: 'Error!',
      timestamp: 2000,
    };
    const line3: ProcessOutputLine = {
      stream: 'stdout',
      line: 'World',
      timestamp: 3000,
    };

    await act(async () => {
      mockEventSourceInstances[0]?._emit('connected', { id: 'test-id' });
    });

    await act(async () => {
      mockEventSourceInstances[0]?._emit('output', line1);
    });

    await waitFor(() => {
      expect(result.current.lines.length).toBe(1);
    });

    await act(async () => {
      mockEventSourceInstances[0]?._emit('output', line2);
      mockEventSourceInstances[0]?._emit('output', line3);
    });

    await waitFor(() => {
      expect(result.current.lines.length).toBe(3);
      expect(result.current.lines[0]).toEqual(line1);
      expect(result.current.lines[1]).toEqual(line2);
      expect(result.current.lines[2]).toEqual(line3);
    });
  });

  it('should handle exit event with code', async () => {
    const { result } = renderHook(() => useProcessOutput('test-id'));

    await act(async () => {
      mockEventSourceInstances[0]?._emit('connected', { id: 'test-id' });
    });

    await act(async () => {
      mockEventSourceInstances[0]?._emit('exit', { code: 0 });
    });

    await waitFor(() => {
      expect(result.current.exitCode).toBe(0);
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('should handle exit event with non-zero code', async () => {
    const { result } = renderHook(() => useProcessOutput('test-id'));

    await act(async () => {
      mockEventSourceInstances[0]?._emit('exit', { code: 1 });
    });

    await waitFor(() => {
      expect(result.current.exitCode).toBe(1);
    });
  });

  it('should handle exit event with null code (killed)', async () => {
    const { result } = renderHook(() => useProcessOutput('test-id'));

    await act(async () => {
      mockEventSourceInstances[0]?._emit('exit', { code: null });
    });

    await waitFor(() => {
      expect(result.current.exitCode).toBeNull();
      expect(result.current.connectionStatus).toBe('disconnected');
    });
  });

  it('should handle connection errors', async () => {
    const { result } = renderHook(() => useProcessOutput('test-id'));

    await act(async () => {
      mockEventSourceInstances[0]?._triggerError();
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('should clear lines when clearLines is called', async () => {
    const { result } = renderHook(() => useProcessOutput('test-id'));

    await act(async () => {
      mockEventSourceInstances[0]?._emit('output', {
        stream: 'stdout',
        line: 'test',
        timestamp: 1000,
      });
    });

    await waitFor(() => {
      expect(result.current.lines.length).toBe(1);
    });

    act(() => {
      result.current.clearLines();
    });

    expect(result.current.lines).toEqual([]);
  });

  it('should reset state when processId changes', async () => {
    const { result, rerender } = renderHook(({ id }) => useProcessOutput(id), {
      initialProps: { id: 'process-1' },
    });

    await act(async () => {
      mockEventSourceInstances[0]?._emit('connected', { id: 'process-1' });
      mockEventSourceInstances[0]?._emit('output', {
        stream: 'stdout',
        line: 'from process 1',
        timestamp: 1000,
      });
    });

    await waitFor(() => {
      expect(result.current.lines.length).toBe(1);
    });

    // Change processId
    await act(async () => {
      rerender({ id: 'process-2' });
    });

    // Should reset and create new connection (effect runs and resets state)
    await waitFor(() => {
      expect(result.current.lines).toEqual([]);
      expect(result.current.exitCode).toBeNull();
      expect(mockEventSourceInstances.length).toBe(2);
      expect(mockEventSourceInstances[1]?.url).toBe(
        '/api/process/process-2/stream',
      );
    });
  });

  it('should close connection on unmount', () => {
    const { unmount } = renderHook(() => useProcessOutput('test-id'));

    expect(mockEventSourceInstances.length).toBe(1);
    const es = mockEventSourceInstances[0];

    unmount();

    expect(es?.readyState).toBe(MockEventSource.CLOSED);
  });

  it('should not connect when processId is undefined', () => {
    renderHook(() => useProcessOutput(undefined));

    expect(mockEventSourceInstances.length).toBe(0);
  });

  it('should provide stable clearLines callback', () => {
    const { result, rerender } = renderHook(() => useProcessOutput('test-id'));

    const firstClearLines = result.current.clearLines;
    rerender();

    expect(result.current.clearLines).toBe(firstClearLines);
  });
});
