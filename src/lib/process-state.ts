/**
 * State machine for process lifecycle management.
 * Provides explicit state transitions to prevent race conditions.
 */

import type { ProcessOutputLine } from './process-runner';

export type ProcessStateIdle = { readonly status: 'idle' };

export type ProcessStateStarting = {
  readonly status: 'starting';
  readonly command: string;
};

export type ProcessStateRunning = {
  readonly status: 'running';
  readonly id: string;
  readonly pid: number;
  readonly lines: ProcessOutputLine[];
};

export type ProcessStateCompleted = {
  readonly status: 'completed';
  readonly id: string;
  readonly exitCode: number | null;
  readonly lines: ProcessOutputLine[];
};

export type ProcessState =
  | ProcessStateIdle
  | ProcessStateStarting
  | ProcessStateRunning
  | ProcessStateCompleted;

export type ProcessActionStart = {
  readonly type: 'START';
  readonly command: string;
};

export type ProcessActionStarted = {
  readonly type: 'STARTED';
  readonly id: string;
  readonly pid: number;
};

export type ProcessActionOutput = {
  readonly type: 'OUTPUT';
  readonly id: string;
  readonly line: ProcessOutputLine;
};

export type ProcessActionExit = {
  readonly type: 'EXIT';
  readonly id: string;
  readonly code: number | null;
};

export type ProcessActionError = {
  readonly type: 'ERROR';
  readonly message: string;
};

export type ProcessActionReset = {
  readonly type: 'RESET';
};

export type ProcessActionReconcile = {
  readonly type: 'RECONCILE';
  readonly serverState: 'running' | 'exited' | 'not_found';
  readonly exitCode?: number | null;
};

export type ProcessActionReplayStart = {
  readonly type: 'REPLAY_START';
  readonly id: string;
};

export type ProcessActionSetLines = {
  readonly type: 'SET_LINES';
  readonly id: string;
  readonly lines: ProcessOutputLine[];
};

export type ProcessActionAttach = {
  readonly type: 'ATTACH';
  readonly id: string;
  readonly pid: number;
};

export type ProcessAction =
  | ProcessActionStart
  | ProcessActionStarted
  | ProcessActionOutput
  | ProcessActionExit
  | ProcessActionError
  | ProcessActionReset
  | ProcessActionReconcile
  | ProcessActionReplayStart
  | ProcessActionSetLines
  | ProcessActionAttach;

export const initialProcessState: ProcessStateIdle = { status: 'idle' };

export function processReducer(
  state: ProcessState,
  action: ProcessAction,
): ProcessState {
  switch (state.status) {
    case 'idle':
      if (action.type === 'START') {
        return { status: 'starting', command: action.command };
      }
      if (action.type === 'ATTACH') {
        return {
          status: 'running',
          id: action.id,
          pid: action.pid,
          lines: [],
        };
      }
      break;

    case 'starting':
      if (action.type === 'STARTED') {
        return {
          status: 'running',
          id: action.id,
          pid: action.pid,
          lines: [],
        };
      }
      if (action.type === 'ERROR') {
        return { status: 'idle' };
      }
      break;

    case 'running':
      if (action.type === 'OUTPUT' && action.id === state.id) {
        return { ...state, lines: [...state.lines, action.line] };
      }
      if (action.type === 'REPLAY_START' && action.id === state.id) {
        return { ...state, lines: [] };
      }
      if (action.type === 'SET_LINES' && action.id === state.id) {
        return { ...state, lines: action.lines };
      }
      if (action.type === 'EXIT' && action.id === state.id) {
        return {
          status: 'completed',
          id: state.id,
          exitCode: action.code,
          lines: state.lines,
        };
      }
      if (action.type === 'RECONCILE' && action.serverState !== 'running') {
        return {
          status: 'completed',
          id: state.id,
          exitCode: action.exitCode ?? null,
          lines: state.lines,
        };
      }
      break;

    case 'completed':
      if (action.type === 'RESET') {
        return { status: 'idle' };
      }
      if (action.type === 'START') {
        return { status: 'starting', command: action.command };
      }
      if (action.type === 'ATTACH') {
        return {
          status: 'running',
          id: action.id,
          pid: action.pid,
          lines: [],
        };
      }
      break;
  }

  return state;
}

export function isIdle(state: ProcessState): state is ProcessStateIdle {
  return state.status === 'idle';
}

export function isStarting(state: ProcessState): state is ProcessStateStarting {
  return state.status === 'starting';
}

export function isProcessRunning(
  state: ProcessState,
): state is ProcessStateRunning {
  return state.status === 'running';
}

export function isCompleted(
  state: ProcessState,
): state is ProcessStateCompleted {
  return state.status === 'completed';
}

export function getProcessId(state: ProcessState): string | null {
  if (state.status === 'running' || state.status === 'completed') {
    return state.id;
  }
  return null;
}

export function getLines(state: ProcessState): ProcessOutputLine[] {
  if (state.status === 'running' || state.status === 'completed') {
    return state.lines;
  }
  return [];
}
