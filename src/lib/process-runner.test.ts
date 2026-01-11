import { describe, expect, it } from 'vitest';
import {
  isExited,
  isNotFound,
  isRunning,
  ProcessStatusFactory,
  type ProcessHandle,
  type ProcessOutputLine,
  type ProcessStatus,
  type ProcessStatusExited,
  type ProcessStatusNotFound,
  type ProcessStatusRunning,
} from './process-runner';

describe('ProcessRunner types', () => {
  describe('ProcessHandle', () => {
    it('can be created with id and pid', () => {
      const handle: ProcessHandle = { id: 'abc123', pid: 12345 };
      expect(handle.id).toBe('abc123');
      expect(handle.pid).toBe(12345);
    });
  });

  describe('ProcessOutputLine', () => {
    it('can represent stdout', () => {
      const line: ProcessOutputLine = {
        stream: 'stdout',
        line: 'hello world',
        timestamp: Date.now(),
      };
      expect(line.stream).toBe('stdout');
      expect(line.line).toBe('hello world');
      expect(typeof line.timestamp).toBe('number');
    });

    it('can represent stderr', () => {
      const line: ProcessOutputLine = {
        stream: 'stderr',
        line: 'error occurred',
        timestamp: Date.now(),
      };
      expect(line.stream).toBe('stderr');
      expect(line.line).toBe('error occurred');
    });
  });

  describe('ProcessStatus discriminated union', () => {
    it('running status has state and pid', () => {
      const status: ProcessStatusRunning = { state: 'running', pid: 1234 };
      expect(status.state).toBe('running');
      expect(status.pid).toBe(1234);
    });

    it('exited status has state and code', () => {
      const status: ProcessStatusExited = { state: 'exited', code: 0 };
      expect(status.state).toBe('exited');
      expect(status.code).toBe(0);
    });

    it('exited status can have null code (killed by signal)', () => {
      const status: ProcessStatusExited = { state: 'exited', code: null };
      expect(status.state).toBe('exited');
      expect(status.code).toBeNull();
    });

    it('not_found status has only state', () => {
      const status: ProcessStatusNotFound = { state: 'not_found' };
      expect(status.state).toBe('not_found');
    });
  });

  describe('type guards', () => {
    describe('isRunning', () => {
      it('returns true for running status', () => {
        const status: ProcessStatus = { state: 'running', pid: 1234 };
        expect(isRunning(status)).toBe(true);
      });

      it('returns false for exited status', () => {
        const status: ProcessStatus = { state: 'exited', code: 0 };
        expect(isRunning(status)).toBe(false);
      });

      it('returns false for not_found status', () => {
        const status: ProcessStatus = { state: 'not_found' };
        expect(isRunning(status)).toBe(false);
      });

      it('narrows type correctly', () => {
        const status: ProcessStatus = { state: 'running', pid: 5678 };
        if (isRunning(status)) {
          // TypeScript knows status is ProcessStatusRunning here
          expect(status.pid).toBe(5678);
        }
      });
    });

    describe('isExited', () => {
      it('returns true for exited status', () => {
        const status: ProcessStatus = { state: 'exited', code: 0 };
        expect(isExited(status)).toBe(true);
      });

      it('returns true for exited with null code', () => {
        const status: ProcessStatus = { state: 'exited', code: null };
        expect(isExited(status)).toBe(true);
      });

      it('returns true for exited with non-zero code', () => {
        const status: ProcessStatus = { state: 'exited', code: 1 };
        expect(isExited(status)).toBe(true);
      });

      it('returns false for running status', () => {
        const status: ProcessStatus = { state: 'running', pid: 1234 };
        expect(isExited(status)).toBe(false);
      });

      it('returns false for not_found status', () => {
        const status: ProcessStatus = { state: 'not_found' };
        expect(isExited(status)).toBe(false);
      });

      it('narrows type correctly', () => {
        const status: ProcessStatus = { state: 'exited', code: 42 };
        if (isExited(status)) {
          // TypeScript knows status is ProcessStatusExited here
          expect(status.code).toBe(42);
        }
      });
    });

    describe('isNotFound', () => {
      it('returns true for not_found status', () => {
        const status: ProcessStatus = { state: 'not_found' };
        expect(isNotFound(status)).toBe(true);
      });

      it('returns false for running status', () => {
        const status: ProcessStatus = { state: 'running', pid: 1234 };
        expect(isNotFound(status)).toBe(false);
      });

      it('returns false for exited status', () => {
        const status: ProcessStatus = { state: 'exited', code: 0 };
        expect(isNotFound(status)).toBe(false);
      });

      it('narrows type correctly', () => {
        const status: ProcessStatus = { state: 'not_found' };
        if (isNotFound(status)) {
          // TypeScript knows status is ProcessStatusNotFound here
          expect(status.state).toBe('not_found');
        }
      });
    });
  });

  describe('ProcessStatusFactory', () => {
    it('creates running status', () => {
      const status = ProcessStatusFactory.running(9999);
      expect(status.state).toBe('running');
      expect(status.pid).toBe(9999);
      expect(isRunning(status)).toBe(true);
    });

    it('creates exited status with code', () => {
      const status = ProcessStatusFactory.exited(0);
      expect(status.state).toBe('exited');
      expect(status.code).toBe(0);
      expect(isExited(status)).toBe(true);
    });

    it('creates exited status with null code', () => {
      const status = ProcessStatusFactory.exited(null);
      expect(status.state).toBe('exited');
      expect(status.code).toBeNull();
      expect(isExited(status)).toBe(true);
    });

    it('creates not_found status', () => {
      const status = ProcessStatusFactory.notFound();
      expect(status.state).toBe('not_found');
      expect(isNotFound(status)).toBe(true);
    });
  });

  describe('type narrowing in switch statements', () => {
    it('allows exhaustive pattern matching', () => {
      const statuses: ProcessStatus[] = [
        { state: 'running', pid: 100 },
        { state: 'exited', code: 0 },
        { state: 'not_found' },
      ];

      const results: string[] = [];

      for (const status of statuses) {
        switch (status.state) {
          case 'running':
            results.push(`running:${status.pid}`);
            break;
          case 'exited':
            results.push(`exited:${status.code}`);
            break;
          case 'not_found':
            results.push('not_found');
            break;
        }
      }

      expect(results).toEqual(['running:100', 'exited:0', 'not_found']);
    });
  });
});
