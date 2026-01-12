/**
 * Integration tests for ProcessRunner implementation.
 * Tests spawn real processes to verify behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createProcessRunner, resolveCommand } from './process-runner';
import { isOk, isErr } from '@/lib/result';
import { isRunning, isExited, isNotFound } from '@/lib/process-runner';

describe('ProcessRunner', () => {
  let runner: ReturnType<typeof createProcessRunner>;

  beforeEach(() => {
    runner = createProcessRunner();
  });

  afterEach(async () => {
    // Clean up any running processes
    const running = runner.listRunning();
    for (const handle of running) {
      await runner.kill(handle.id);
    }
  });

  describe('start', () => {
    it('should spawn a process and return a handle', async () => {
      const result = await runner.start({
        command: 'echo hello',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.id).toBeDefined();
        expect(typeof result.value.id).toBe('string');
        expect(result.value.pid).toBeDefined();
        expect(typeof result.value.pid).toBe('number');
      }
    });

    it('should return error for invalid command', async () => {
      const result = await runner.start({
        command: '/nonexistent/command/that/does/not/exist/xyz123',
        cwd: process.cwd(),
      });

      // For shell mode, it may still spawn but exit with error
      // Let's wait for the process to exit
      if (isOk(result)) {
        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 100));
        const status = runner.getStatus(result.value.id);
        // Should have exited with non-zero code
        expect(isExited(status)).toBe(true);
        if (isExited(status)) {
          expect(status.code).not.toBe(0);
        }
      }
    });
  });

  describe('getStatus', () => {
    it('should return not_found for unknown id', () => {
      const status = runner.getStatus('unknown-id');
      expect(isNotFound(status)).toBe(true);
    });

    it('should return running for active process', async () => {
      const result = await runner.start({
        command: 'sleep 10',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const status = runner.getStatus(result.value.id);
        expect(isRunning(status)).toBe(true);
        if (isRunning(status)) {
          expect(status.pid).toBe(result.value.pid);
        }
      }
    });

    it('should return exited after process completes', async () => {
      const result = await runner.start({
        command: 'echo done',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 100));

        const status = runner.getStatus(result.value.id);
        expect(isExited(status)).toBe(true);
        if (isExited(status)) {
          expect(status.code).toBe(0);
        }
      }
    });

    it('should return exited with non-zero code for failed process', async () => {
      const result = await runner.start({
        command: 'exit 42',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 100));

        const status = runner.getStatus(result.value.id);
        expect(isExited(status)).toBe(true);
        if (isExited(status)) {
          expect(status.code).toBe(42);
        }
      }
    });
  });

  describe('kill', () => {
    it('should return error for unknown id', async () => {
      const result = await runner.kill('unknown-id');
      expect(isErr(result)).toBe(true);
    });

    it('should kill running process', async () => {
      const startResult = await runner.start({
        command: 'sleep 60',
        cwd: process.cwd(),
      });

      expect(isOk(startResult)).toBe(true);
      if (isOk(startResult)) {
        // Verify it's running
        let status = runner.getStatus(startResult.value.id);
        expect(isRunning(status)).toBe(true);

        // Kill it
        const killResult = await runner.kill(startResult.value.id);
        expect(isOk(killResult)).toBe(true);

        // Wait for kill to take effect
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should be exited now
        status = runner.getStatus(startResult.value.id);
        expect(isExited(status)).toBe(true);
      }
    });

    it('should return error when killing already exited process', async () => {
      const startResult = await runner.start({
        command: 'echo quick',
        cwd: process.cwd(),
      });

      expect(isOk(startResult)).toBe(true);
      if (isOk(startResult)) {
        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 100));

        const killResult = await runner.kill(startResult.value.id);
        expect(isErr(killResult)).toBe(true);
      }
    });
  });

  describe('onOutput', () => {
    it('should capture stdout output', async () => {
      const result = await runner.start({
        command: 'echo hello world',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines: Array<{ stream: string; line: string }> = [];
        runner.onOutput(result.value.id, (line) => {
          lines.push({ stream: line.stream, line: line.line });
        });

        // Wait for output
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(lines.some((l) => l.line === 'hello world')).toBe(true);
        expect(lines.every((l) => l.stream === 'stdout')).toBe(true);
      }
    });

    it('should capture stderr output', async () => {
      const result = await runner.start({
        command: 'echo error >&2',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines: Array<{ stream: string; line: string }> = [];
        runner.onOutput(result.value.id, (line) => {
          lines.push({ stream: line.stream, line: line.line });
        });

        // Wait for output
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(lines.some((l) => l.line === 'error')).toBe(true);
        expect(lines.some((l) => l.stream === 'stderr')).toBe(true);
      }
    });

    it('should include timestamp in output lines', async () => {
      const before = Date.now();
      const result = await runner.start({
        command: 'echo test',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines: Array<{ timestamp: number }> = [];
        runner.onOutput(result.value.id, (line) => {
          lines.push({ timestamp: line.timestamp });
        });

        // Wait for output
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(lines.length).toBeGreaterThan(0);
        const firstLine = lines[0];
        expect(firstLine).toBeDefined();
        expect(firstLine!.timestamp).toBeGreaterThanOrEqual(before);
        expect(firstLine!.timestamp).toBeLessThanOrEqual(Date.now());
      }
    });

    it('should return unsubscribe function', async () => {
      const result = await runner.start({
        command: 'echo first; sleep 0.1; echo second',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines: string[] = [];
        const unsubscribe = runner.onOutput(result.value.id, (line) => {
          lines.push(line.line);
        });

        // Get initial output
        await new Promise((resolve) => setTimeout(resolve, 50));
        unsubscribe();

        const countAfterUnsub = lines.length;

        // Wait for more potential output
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Should not have received more after unsubscribe
        expect(lines.length).toBe(countAfterUnsub);
      }
    });

    it('should return noop for unknown process', () => {
      const unsubscribe = runner.onOutput('unknown-id', () => {});
      expect(typeof unsubscribe).toBe('function');
      // Should not throw
      unsubscribe();
    });

    it('should replay existing output to new subscribers', async () => {
      const result = await runner.start({
        command: 'echo existing output',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Wait for output
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Subscribe after output has been generated
        const lines: string[] = [];
        runner.onOutput(result.value.id, (line) => {
          lines.push(line.line);
        });

        // Should immediately receive replayed output
        expect(lines.some((l) => l === 'existing output')).toBe(true);
      }
    });
  });

  describe('getOutput', () => {
    it('should return empty array for unknown process', () => {
      const output = runner.getOutput('unknown-id');
      expect(output).toEqual([]);
    });

    it('should return buffered output lines', async () => {
      const result = await runner.start({
        command: 'echo line1; echo line2',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Wait for output
        await new Promise((resolve) => setTimeout(resolve, 100));

        const output = runner.getOutput(result.value.id);
        expect(output.length).toBeGreaterThanOrEqual(2);
        expect(output.map((l) => l.line)).toContain('line1');
        expect(output.map((l) => l.line)).toContain('line2');
      }
    });

    it('should return a copy, not the internal array', async () => {
      const result = await runner.start({
        command: 'echo test',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Wait for output
        await new Promise((resolve) => setTimeout(resolve, 100));

        const output1 = runner.getOutput(result.value.id);
        const output2 = runner.getOutput(result.value.id);

        expect(output1).not.toBe(output2);
        expect(output1).toEqual(output2);
      }
    });

    it('should include both stdout and stderr in buffer', async () => {
      const result = await runner.start({
        command: 'echo stdout; echo stderr >&2',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Wait for output
        await new Promise((resolve) => setTimeout(resolve, 100));

        const output = runner.getOutput(result.value.id);
        expect(output.some((l) => l.stream === 'stdout')).toBe(true);
        expect(output.some((l) => l.stream === 'stderr')).toBe(true);
      }
    });
  });

  describe('onExit', () => {
    it('should call callback when process exits', async () => {
      const result = await runner.start({
        command: 'echo done',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const exitCodes: Array<number | null> = [];
        runner.onExit(result.value.id, (code) => {
          exitCodes.push(code);
        });

        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(exitCodes).toEqual([0]);
      }
    });

    it('should pass exit code to callback', async () => {
      const result = await runner.start({
        command: 'exit 42',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const exitCodes: Array<number | null> = [];
        runner.onExit(result.value.id, (code) => {
          exitCodes.push(code);
        });

        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(exitCodes).toEqual([42]);
      }
    });

    it('should call callback immediately if process already exited', async () => {
      const result = await runner.start({
        command: 'echo done',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Wait for process to exit first
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Now subscribe - should get immediate callback
        const exitCodes: Array<number | null> = [];
        runner.onExit(result.value.id, (code) => {
          exitCodes.push(code);
        });

        // Should have been called synchronously
        expect(exitCodes).toEqual([0]);
      }
    });

    it('should return unsubscribe function', async () => {
      const result = await runner.start({
        command: 'sleep 0.2',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const exitCodes: Array<number | null> = [];
        const unsubscribe = runner.onExit(result.value.id, (code) => {
          exitCodes.push(code);
        });

        // Unsubscribe immediately
        unsubscribe();

        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Should not have received the callback
        expect(exitCodes).toEqual([]);
      }
    });

    it('should return noop for unknown process', () => {
      const unsubscribe = runner.onExit('unknown-id', () => {});
      expect(typeof unsubscribe).toBe('function');
      // Should not throw
      unsubscribe();
    });

    it('should support multiple exit subscribers', async () => {
      const result = await runner.start({
        command: 'echo done',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const calls1: Array<number | null> = [];
        const calls2: Array<number | null> = [];

        runner.onExit(result.value.id, (code) => calls1.push(code));
        runner.onExit(result.value.id, (code) => calls2.push(code));

        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(calls1).toEqual([0]);
        expect(calls2).toEqual([0]);
      }
    });
  });

  describe('listRunning', () => {
    it('should return empty array when no processes', () => {
      const running = runner.listRunning();
      expect(running).toEqual([]);
    });

    it('should include running processes', async () => {
      const result = await runner.start({
        command: 'sleep 60',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const running = runner.listRunning();
        expect(running).toHaveLength(1);
        expect(running[0]?.id).toBe(result.value.id);
        expect(running[0]?.pid).toBe(result.value.pid);
      }
    });

    it('should not include exited processes', async () => {
      const result = await runner.start({
        command: 'echo done',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 100));

        const running = runner.listRunning();
        expect(running).toHaveLength(0);
      }
    });

    it('should handle multiple running processes', async () => {
      const results = await Promise.all([
        runner.start({ command: 'sleep 60', cwd: process.cwd() }),
        runner.start({ command: 'sleep 60', cwd: process.cwd() }),
        runner.start({ command: 'sleep 60', cwd: process.cwd() }),
      ]);

      const allOk = results.every(isOk);
      expect(allOk).toBe(true);

      const running = runner.listRunning();
      expect(running).toHaveLength(3);
    });
  });

  describe('process lifecycle transitions', () => {
    it('should correctly transition from running to exited', async () => {
      const result = await runner.start({
        command: 'sleep 0.1',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Initially running
        let status = runner.getStatus(result.value.id);
        expect(isRunning(status)).toBe(true);

        // Wait for process to exit
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Should be exited
        status = runner.getStatus(result.value.id);
        expect(isExited(status)).toBe(true);
        if (isExited(status)) {
          expect(status.code).toBe(0);
        }
      }
    });

    it('should capture multi-line output in order', async () => {
      const result = await runner.start({
        command: 'echo line1; echo line2; echo line3',
        cwd: process.cwd(),
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const lines: string[] = [];
        runner.onOutput(result.value.id, (line) => {
          lines.push(line.line);
        });

        // Wait for output
        await new Promise((resolve) => setTimeout(resolve, 100));

        expect(lines).toContain('line1');
        expect(lines).toContain('line2');
        expect(lines).toContain('line3');

        // Verify order
        const idx1 = lines.indexOf('line1');
        const idx2 = lines.indexOf('line2');
        const idx3 = lines.indexOf('line3');
        expect(idx1).toBeLessThan(idx2);
        expect(idx2).toBeLessThan(idx3);
      }
    });
  });
});

describe('resolveCommand', () => {
  const originalEnv = process.env.RALPH_BIN;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.RALPH_BIN = originalEnv;
    } else {
      delete process.env.RALPH_BIN;
    }
  });

  it('should return command unchanged when RALPH_BIN is not set', () => {
    delete process.env.RALPH_BIN;
    expect(resolveCommand('ralph-once')).toBe('ralph-once');
  });

  it('should return non-ralph command unchanged when RALPH_BIN is set', () => {
    process.env.RALPH_BIN = '/path/to/bin';
    expect(resolveCommand('echo hello')).toBe('echo hello');
  });

  it('should prepend RALPH_BIN to ralph command', () => {
    process.env.RALPH_BIN = '/path/to/bin';
    expect(resolveCommand('ralph')).toBe('/path/to/bin/ralph');
  });

  it('should prepend RALPH_BIN to ralph-once command', () => {
    process.env.RALPH_BIN = '/path/to/bin';
    expect(resolveCommand('ralph-once')).toBe('/path/to/bin/ralph-once');
  });

  it('should preserve arguments when prepending RALPH_BIN', () => {
    process.env.RALPH_BIN = '/path/to/bin';
    expect(resolveCommand('ralph-once --verbose')).toBe(
      '/path/to/bin/ralph-once --verbose',
    );
  });

  it('should handle RALPH_BIN with trailing slash', () => {
    process.env.RALPH_BIN = '/path/to/bin/';
    expect(resolveCommand('ralph-once')).toBe('/path/to/bin/ralph-once');
  });

  it('should handle commands with leading whitespace', () => {
    process.env.RALPH_BIN = '/path/to/bin';
    expect(resolveCommand('  ralph-once')).toBe('/path/to/bin/ralph-once');
  });

  it('should not modify commands that contain ralph but do not start with it', () => {
    process.env.RALPH_BIN = '/path/to/bin';
    expect(resolveCommand('my-ralph-tool')).toBe('my-ralph-tool');
  });

  it('should handle ralph commands with multiple arguments', () => {
    process.env.RALPH_BIN = '/path/to/bin';
    expect(resolveCommand('ralph run --flag value')).toBe(
      '/path/to/bin/ralph run --flag value',
    );
  });
});
