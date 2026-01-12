import { describe, it, expect, afterEach } from 'vitest';
import { processRouter, setRunner } from './process';
import type { Context } from '../trpc';
import type {
  ProcessRunner,
  ProcessHandle,
  ProcessStatus,
  ProcessOutputLine,
} from '@/lib/process-runner';
import { ok, err } from '@/lib/result';
import { ProcessStatusFactory } from '@/lib/process-runner';

const TEST_DIR = '/test/ralph/dir';

/**
 * Create a test caller with mock context
 */
function createTestCaller() {
  const ctx: Context = {
    ralphDir: TEST_DIR,
  };
  return processRouter.createCaller(ctx);
}

/**
 * Create a mock ProcessRunner with canned responses.
 * Each method can be configured via the mocks object.
 */
function createMockRunner(mocks: {
  start?: (opts: {
    command: string;
    cwd: string;
  }) => ReturnType<ProcessRunner['start']>;
  getStatus?: (id: string) => ProcessStatus;
  kill?: (id: string) => ReturnType<ProcessRunner['kill']>;
  listRunning?: () => ProcessHandle[];
  onOutput?: ProcessRunner['onOutput'];
  onExit?: ProcessRunner['onExit'];
  getOutput?: (id: string) => ProcessOutputLine[];
}): ProcessRunner {
  return {
    start: mocks.start ?? (async () => ok({ id: 'mock-id', pid: 12345 })),
    getStatus: mocks.getStatus ?? (() => ProcessStatusFactory.notFound()),
    kill: mocks.kill ?? (async () => ok(undefined)),
    listRunning: mocks.listRunning ?? (() => []),
    onOutput: mocks.onOutput ?? (() => () => {}),
    onExit: mocks.onExit ?? (() => () => {}),
    getOutput: mocks.getOutput ?? (() => []),
  };
}

describe('process router', () => {
  afterEach(() => {
    // Reset the runner after each test
    setRunner(null);
  });

  describe('start', () => {
    it('calls runner.start with correct arguments', async () => {
      let capturedOpts: { command: string; cwd: string } | null = null;
      const mockRunner = createMockRunner({
        start: async (opts) => {
          capturedOpts = opts;
          return ok({ id: 'test-123', pid: 9876 });
        },
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      await caller.start({ command: 'echo hello' });

      expect(capturedOpts).toEqual({
        command: 'echo hello',
        cwd: TEST_DIR,
      });
    });

    it('returns process handle on success', async () => {
      const expectedHandle: ProcessHandle = { id: 'proc-abc', pid: 54321 };
      const mockRunner = createMockRunner({
        start: async () => ok(expectedHandle),
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      const handle = await caller.start({ command: 'sleep 10' });

      expect(handle).toEqual(expectedHandle);
    });

    it('throws error when start fails', async () => {
      const mockRunner = createMockRunner({
        start: async () => err(new Error('Spawn failed')),
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      await expect(caller.start({ command: 'bad-command' })).rejects.toThrow(
        'Failed to start process: Spawn failed',
      );
    });

    it('validates command is not empty', async () => {
      const mockRunner = createMockRunner({});
      setRunner(mockRunner);

      const caller = createTestCaller();
      await expect(caller.start({ command: '' })).rejects.toThrow();
    });
  });

  describe('status', () => {
    it('calls runner.getStatus with correct id', async () => {
      let capturedId: string | null = null;
      const mockRunner = createMockRunner({
        getStatus: (id) => {
          capturedId = id;
          return ProcessStatusFactory.running(1234);
        },
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      await caller.status({ id: 'my-proc-id' });

      expect(capturedId).toBe('my-proc-id');
    });

    it('returns running status', async () => {
      const mockRunner = createMockRunner({
        getStatus: () => ProcessStatusFactory.running(5555),
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      const status = await caller.status({ id: 'proc-1' });

      expect(status).toEqual({ state: 'running', pid: 5555 });
    });

    it('returns exited status', async () => {
      const mockRunner = createMockRunner({
        getStatus: () => ProcessStatusFactory.exited(0),
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      const status = await caller.status({ id: 'proc-1' });

      expect(status).toEqual({ state: 'exited', code: 0 });
    });

    it('returns not_found status', async () => {
      const mockRunner = createMockRunner({
        getStatus: () => ProcessStatusFactory.notFound(),
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      const status = await caller.status({ id: 'unknown' });

      expect(status).toEqual({ state: 'not_found' });
    });

    it('validates id is not empty', async () => {
      const mockRunner = createMockRunner({});
      setRunner(mockRunner);

      const caller = createTestCaller();
      await expect(caller.status({ id: '' })).rejects.toThrow();
    });
  });

  describe('kill', () => {
    it('calls runner.kill with correct id', async () => {
      let capturedId: string | null = null;
      const mockRunner = createMockRunner({
        kill: async (id) => {
          capturedId = id;
          return ok(undefined);
        },
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      await caller.kill({ id: 'proc-to-kill' });

      expect(capturedId).toBe('proc-to-kill');
    });

    it('returns success on successful kill', async () => {
      const mockRunner = createMockRunner({
        kill: async () => ok(undefined),
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      const result = await caller.kill({ id: 'proc-1' });

      expect(result).toEqual({ success: true });
    });

    it('throws error when kill fails', async () => {
      const mockRunner = createMockRunner({
        kill: async () => err(new Error('Process not found')),
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      await expect(caller.kill({ id: 'unknown' })).rejects.toThrow(
        'Failed to kill process: Process not found',
      );
    });

    it('validates id is not empty', async () => {
      const mockRunner = createMockRunner({});
      setRunner(mockRunner);

      const caller = createTestCaller();
      await expect(caller.kill({ id: '' })).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('calls runner.listRunning', async () => {
      let listCalled = false;
      const mockRunner = createMockRunner({
        listRunning: () => {
          listCalled = true;
          return [];
        },
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      await caller.list();

      expect(listCalled).toBe(true);
    });

    it('returns empty array when no processes running', async () => {
      const mockRunner = createMockRunner({
        listRunning: () => [],
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      const handles = await caller.list();

      expect(handles).toEqual([]);
    });

    it('returns all running process handles', async () => {
      const runningHandles: ProcessHandle[] = [
        { id: 'proc-1', pid: 1001 },
        { id: 'proc-2', pid: 1002 },
        { id: 'proc-3', pid: 1003 },
      ];
      const mockRunner = createMockRunner({
        listRunning: () => runningHandles,
      });
      setRunner(mockRunner);

      const caller = createTestCaller();
      const handles = await caller.list();

      expect(handles).toEqual(runningHandles);
      expect(handles).toHaveLength(3);
    });
  });
});
