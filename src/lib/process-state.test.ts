import { describe, it, expect } from 'vitest';
import {
  processReducer,
  initialProcessState,
  isIdle,
  isStarting,
  isProcessRunning,
  isCompleted,
  getProcessId,
  getLines,
  type ProcessState,
  type ProcessAction,
} from './process-state';
import type { ProcessOutputLine } from './process-runner';

describe('processReducer', () => {
  describe('idle state', () => {
    it('transitions to starting on START action', () => {
      const state = processReducer(initialProcessState, {
        type: 'START',
        command: 'ralph-once',
      });
      expect(state).toEqual({ status: 'starting', command: 'ralph-once' });
    });

    it('ignores invalid actions', () => {
      const invalidActions: ProcessAction[] = [
        { type: 'STARTED', id: 'test', pid: 123 },
        { type: 'OUTPUT', id: 'test', line: makeLine('hello') },
        { type: 'EXIT', id: 'test', code: 0 },
        { type: 'ERROR', message: 'oops' },
        { type: 'RESET' },
        { type: 'RECONCILE', serverState: 'exited', exitCode: 0 },
        { type: 'REPLAY_START', id: 'test' },
        { type: 'SET_LINES', id: 'test', lines: [] },
      ];

      for (const action of invalidActions) {
        const result = processReducer(initialProcessState, action);
        expect(result).toBe(initialProcessState);
      }
    });
  });

  describe('starting state', () => {
    const startingState: ProcessState = {
      status: 'starting',
      command: 'ralph-once',
    };

    it('transitions to running on STARTED action', () => {
      const state = processReducer(startingState, {
        type: 'STARTED',
        id: 'proc-1',
        pid: 456,
      });
      expect(state).toEqual({
        status: 'running',
        id: 'proc-1',
        pid: 456,
        lines: [],
      });
    });

    it('transitions to idle on ERROR action', () => {
      const state = processReducer(startingState, {
        type: 'ERROR',
        message: 'Failed to start',
      });
      expect(state).toEqual({ status: 'idle' });
    });

    it('ignores invalid actions', () => {
      const invalidActions: ProcessAction[] = [
        { type: 'START', command: 'another' },
        { type: 'OUTPUT', id: 'test', line: makeLine('hello') },
        { type: 'EXIT', id: 'test', code: 0 },
        { type: 'RESET' },
        { type: 'RECONCILE', serverState: 'exited', exitCode: 0 },
      ];

      for (const action of invalidActions) {
        const result = processReducer(startingState, action);
        expect(result).toBe(startingState);
      }
    });
  });

  describe('running state', () => {
    const runningState: ProcessState = {
      status: 'running',
      id: 'proc-1',
      pid: 456,
      lines: [],
    };

    it('appends output on OUTPUT action with matching id', () => {
      const line = makeLine('hello world');
      const state = processReducer(runningState, {
        type: 'OUTPUT',
        id: 'proc-1',
        line,
      });
      expect(state).toEqual({ ...runningState, lines: [line] });
    });

    it('ignores OUTPUT action with non-matching id', () => {
      const line = makeLine('hello');
      const state = processReducer(runningState, {
        type: 'OUTPUT',
        id: 'other-proc',
        line,
      });
      expect(state).toBe(runningState);
    });

    it('clears lines on REPLAY_START with matching id', () => {
      const stateWithLines: ProcessState = {
        ...runningState,
        lines: [makeLine('old')],
      };
      const state = processReducer(stateWithLines, {
        type: 'REPLAY_START',
        id: 'proc-1',
      });
      expect(state).toEqual({ ...stateWithLines, lines: [] });
    });

    it('ignores REPLAY_START with non-matching id', () => {
      const stateWithLines: ProcessState = {
        ...runningState,
        lines: [makeLine('old')],
      };
      const state = processReducer(stateWithLines, {
        type: 'REPLAY_START',
        id: 'other',
      });
      expect(state).toBe(stateWithLines);
    });

    it('sets lines on SET_LINES with matching id', () => {
      const newLines = [makeLine('restored')];
      const state = processReducer(runningState, {
        type: 'SET_LINES',
        id: 'proc-1',
        lines: newLines,
      });
      expect(state).toEqual({ ...runningState, lines: newLines });
    });

    it('ignores SET_LINES with non-matching id', () => {
      const state = processReducer(runningState, {
        type: 'SET_LINES',
        id: 'other',
        lines: [makeLine('ignored')],
      });
      expect(state).toBe(runningState);
    });

    it('transitions to completed on EXIT action with matching id', () => {
      const stateWithLines: ProcessState = {
        ...runningState,
        lines: [makeLine('output')],
      };
      const state = processReducer(stateWithLines, {
        type: 'EXIT',
        id: 'proc-1',
        code: 0,
      });
      expect(state).toEqual({
        status: 'completed',
        id: 'proc-1',
        exitCode: 0,
        lines: [makeLine('output')],
      });
    });

    it('ignores EXIT action with non-matching id', () => {
      const state = processReducer(runningState, {
        type: 'EXIT',
        id: 'other-proc',
        code: 0,
      });
      expect(state).toBe(runningState);
    });

    it('transitions to completed on RECONCILE with non-running server state', () => {
      const state = processReducer(runningState, {
        type: 'RECONCILE',
        serverState: 'exited',
        exitCode: 1,
      });
      expect(state).toEqual({
        status: 'completed',
        id: 'proc-1',
        exitCode: 1,
        lines: [],
      });
    });

    it('transitions to completed on RECONCILE with not_found server state', () => {
      const state = processReducer(runningState, {
        type: 'RECONCILE',
        serverState: 'not_found',
      });
      expect(state).toEqual({
        status: 'completed',
        id: 'proc-1',
        exitCode: null,
        lines: [],
      });
    });

    it('ignores RECONCILE with running server state', () => {
      const state = processReducer(runningState, {
        type: 'RECONCILE',
        serverState: 'running',
      });
      expect(state).toBe(runningState);
    });

    it('ignores invalid actions', () => {
      const invalidActions: ProcessAction[] = [
        { type: 'START', command: 'another' },
        { type: 'STARTED', id: 'new', pid: 789 },
        { type: 'ERROR', message: 'oops' },
        { type: 'RESET' },
      ];

      for (const action of invalidActions) {
        const result = processReducer(runningState, action);
        expect(result).toBe(runningState);
      }
    });
  });

  describe('completed state', () => {
    const completedState: ProcessState = {
      status: 'completed',
      id: 'proc-1',
      exitCode: 0,
      lines: [makeLine('done')],
    };

    it('transitions to idle on RESET action', () => {
      const state = processReducer(completedState, { type: 'RESET' });
      expect(state).toEqual({ status: 'idle' });
    });

    it('transitions to starting on START action', () => {
      const state = processReducer(completedState, {
        type: 'START',
        command: 'ralph',
      });
      expect(state).toEqual({ status: 'starting', command: 'ralph' });
    });

    it('ignores invalid actions', () => {
      const invalidActions: ProcessAction[] = [
        { type: 'STARTED', id: 'new', pid: 789 },
        { type: 'OUTPUT', id: 'proc-1', line: makeLine('more') },
        { type: 'EXIT', id: 'proc-1', code: 1 },
        { type: 'ERROR', message: 'oops' },
        { type: 'RECONCILE', serverState: 'exited', exitCode: 0 },
        { type: 'REPLAY_START', id: 'proc-1' },
        { type: 'SET_LINES', id: 'proc-1', lines: [] },
      ];

      for (const action of invalidActions) {
        const result = processReducer(completedState, action);
        expect(result).toBe(completedState);
      }
    });
  });

  describe('rapid state changes', () => {
    it('handles start -> started -> output -> exit sequence', () => {
      let state: ProcessState = initialProcessState;

      state = processReducer(state, { type: 'START', command: 'ralph-once' });
      expect(state.status).toBe('starting');

      state = processReducer(state, {
        type: 'STARTED',
        id: 'proc-1',
        pid: 100,
      });
      expect(state.status).toBe('running');

      state = processReducer(state, {
        type: 'OUTPUT',
        id: 'proc-1',
        line: makeLine('line 1'),
      });
      if (state.status === 'running') {
        expect(state.lines).toHaveLength(1);
      }

      state = processReducer(state, {
        type: 'OUTPUT',
        id: 'proc-1',
        line: makeLine('line 2'),
      });
      if (state.status === 'running') {
        expect(state.lines).toHaveLength(2);
      }

      state = processReducer(state, { type: 'EXIT', id: 'proc-1', code: 0 });
      expect(state.status).toBe('completed');
      if (state.status === 'completed') {
        expect(state.exitCode).toBe(0);
        expect(state.lines).toHaveLength(2);
      }
    });

    it('handles restart after completion', () => {
      let state: ProcessState = {
        status: 'completed',
        id: 'proc-1',
        exitCode: 0,
        lines: [makeLine('old')],
      };

      state = processReducer(state, { type: 'START', command: 'ralph' });
      expect(state.status).toBe('starting');

      state = processReducer(state, {
        type: 'STARTED',
        id: 'proc-2',
        pid: 200,
      });
      expect(state.status).toBe('running');
      if (state.status === 'running') {
        expect(state.id).toBe('proc-2');
        expect(state.lines).toEqual([]);
      }
    });
  });
});

describe('type guards', () => {
  it('isIdle returns true only for idle state', () => {
    expect(isIdle({ status: 'idle' })).toBe(true);
    expect(isIdle({ status: 'starting', command: 'test' })).toBe(false);
    expect(isIdle({ status: 'running', id: 'x', pid: 1, lines: [] })).toBe(
      false,
    );
    expect(
      isIdle({ status: 'completed', id: 'x', exitCode: 0, lines: [] }),
    ).toBe(false);
  });

  it('isStarting returns true only for starting state', () => {
    expect(isStarting({ status: 'idle' })).toBe(false);
    expect(isStarting({ status: 'starting', command: 'test' })).toBe(true);
    expect(isStarting({ status: 'running', id: 'x', pid: 1, lines: [] })).toBe(
      false,
    );
    expect(
      isStarting({ status: 'completed', id: 'x', exitCode: 0, lines: [] }),
    ).toBe(false);
  });

  it('isProcessRunning returns true only for running state', () => {
    expect(isProcessRunning({ status: 'idle' })).toBe(false);
    expect(isProcessRunning({ status: 'starting', command: 'test' })).toBe(
      false,
    );
    expect(
      isProcessRunning({ status: 'running', id: 'x', pid: 1, lines: [] }),
    ).toBe(true);
    expect(
      isProcessRunning({
        status: 'completed',
        id: 'x',
        exitCode: 0,
        lines: [],
      }),
    ).toBe(false);
  });

  it('isCompleted returns true only for completed state', () => {
    expect(isCompleted({ status: 'idle' })).toBe(false);
    expect(isCompleted({ status: 'starting', command: 'test' })).toBe(false);
    expect(isCompleted({ status: 'running', id: 'x', pid: 1, lines: [] })).toBe(
      false,
    );
    expect(
      isCompleted({ status: 'completed', id: 'x', exitCode: 0, lines: [] }),
    ).toBe(true);
  });
});

describe('helper functions', () => {
  it('getProcessId returns id for running/completed states', () => {
    expect(getProcessId({ status: 'idle' })).toBeNull();
    expect(getProcessId({ status: 'starting', command: 'test' })).toBeNull();
    expect(
      getProcessId({ status: 'running', id: 'proc-1', pid: 1, lines: [] }),
    ).toBe('proc-1');
    expect(
      getProcessId({
        status: 'completed',
        id: 'proc-2',
        exitCode: 0,
        lines: [],
      }),
    ).toBe('proc-2');
  });

  it('getLines returns lines for running/completed states', () => {
    const lines = [makeLine('test')];
    expect(getLines({ status: 'idle' })).toEqual([]);
    expect(getLines({ status: 'starting', command: 'test' })).toEqual([]);
    expect(
      getLines({ status: 'running', id: 'proc-1', pid: 1, lines }),
    ).toEqual(lines);
    expect(
      getLines({ status: 'completed', id: 'proc-1', exitCode: 0, lines }),
    ).toEqual(lines);
  });
});

function makeLine(
  text: string,
  stream: 'stdout' | 'stderr' = 'stdout',
): ProcessOutputLine {
  return { stream, line: text, timestamp: Date.now() };
}
