import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import { RalphControls } from './RalphControls';
import type { UseProcessOutputResult } from '@/hooks/use-process-output';

// Mock the hooks and modules
vi.mock('@/hooks/use-process-output', () => ({
  useProcessOutput: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock tRPC
const mockStartMutate = vi.fn();
const mockKillMutate = vi.fn();
let startMutationOptions: {
  onSuccess?: (
    data: { id: string; pid: number },
    variables: { command: string },
  ) => void;
  onError?: (error: Error) => void;
} = {};
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- needed for type completeness
let killMutationOptions: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
} = {};

vi.mock('@/lib/trpc', () => ({
  trpc: {
    process: {
      start: {
        useMutation: vi.fn(
          (options: {
            onSuccess?: (
              data: { id: string; pid: number },
              variables: { command: string },
            ) => void;
            onError?: (error: Error) => void;
          }) => {
            startMutationOptions = options;
            return {
              mutate: mockStartMutate,
              isPending: false,
            };
          },
        ),
      },
      kill: {
        useMutation: vi.fn(
          (options: {
            onSuccess?: () => void;
            onError?: (error: Error) => void;
          }) => {
            killMutationOptions = options;
            return {
              mutate: mockKillMutate,
              isPending: false,
            };
          },
        ),
      },
    },
  },
}));

// Import mocked modules
import { useProcessOutput } from '@/hooks/use-process-output';
const mockUseProcessOutput = vi.mocked(useProcessOutput);

// Helper to create mock hook result
function createMockResult(
  overrides: Partial<UseProcessOutputResult> = {},
): UseProcessOutputResult {
  return {
    lines: [],
    isConnected: false,
    exitCode: null,
    connectionStatus: 'disconnected',
    clearLines: vi.fn(),
    ...overrides,
  };
}

describe('RalphControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProcessOutput.mockReturnValue(createMockResult());
    startMutationOptions = {};
    killMutationOptions = {};
  });

  describe('initial rendering', () => {
    it('should render Run Next Ticket button', () => {
      render(<RalphControls />);
      expect(
        screen.getByRole('button', { name: 'Run Next Ticket' }),
      ).toBeInTheDocument();
    });

    it('should render Run All button', () => {
      render(<RalphControls />);
      expect(
        screen.getByRole('button', { name: 'Run All' }),
      ).toBeInTheDocument();
    });

    it('should not show Stop button initially', () => {
      render(<RalphControls />);
      expect(
        screen.queryByRole('button', { name: 'Stop' }),
      ).not.toBeInTheDocument();
    });

    it('should not show output panel initially', () => {
      render(<RalphControls />);
      expect(screen.queryByText('Hide Output')).not.toBeInTheDocument();
      expect(screen.queryByText('Show Output')).not.toBeInTheDocument();
    });
  });

  describe('starting processes', () => {
    it('should call start mutation with ralph-once on Run Next Ticket click', () => {
      render(<RalphControls />);

      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      expect(mockStartMutate).toHaveBeenCalledWith({ command: 'ralph-once' });
    });

    it('should call start mutation with ralph on Run All click', () => {
      render(<RalphControls />);

      const button = screen.getByRole('button', { name: 'Run All' });
      fireEvent.click(button);

      expect(mockStartMutate).toHaveBeenCalledWith({ command: 'ralph' });
    });
  });

  describe('running state', () => {
    it('should show status text when process is running', () => {
      render(<RalphControls />);

      // Click to start
      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      // Simulate successful start
      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Should show running status
      expect(screen.getByTestId('status-text')).toHaveTextContent(
        'Running next ticket...',
      );
    });

    it('should show output panel when process is started', () => {
      render(<RalphControls />);

      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      expect(screen.getByTestId('toggle-output')).toBeInTheDocument();
    });

    it('should show Stop button when process is running', () => {
      render(<RalphControls />);

      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      expect(screen.getByTestId('stop-button')).toBeInTheDocument();
    });
  });

  describe('stopping processes', () => {
    it('should call kill mutation when Stop is clicked', () => {
      render(<RalphControls />);

      // Start a process
      const runButton = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(runButton);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Click stop
      const stopButton = screen.getByTestId('stop-button');
      fireEvent.click(stopButton);

      expect(mockKillMutate).toHaveBeenCalledWith({ id: 'test-proc-id' });
    });
  });

  describe('output panel visibility', () => {
    it('should toggle output visibility when clicking toggle button', () => {
      render(<RalphControls />);

      // Start a process to show the output panel
      const runButton = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(runButton);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Toggle should say "Hide Output" since outputOpen is true after start
      expect(screen.getByTestId('toggle-output')).toHaveTextContent(
        'Hide Output',
      );

      // Click to hide
      fireEvent.click(screen.getByTestId('toggle-output'));

      expect(screen.getByTestId('toggle-output')).toHaveTextContent(
        'Show Output',
      );
    });
  });

  describe('process completion', () => {
    it('should show Completed status for exit code 0', async () => {
      // Start with normal state
      const { rerender } = render(<RalphControls />);

      // Start a process
      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Now mock the hook to return exit code 0
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          exitCode: 0,
          connectionStatus: 'disconnected',
        }),
      );

      // Rerender to trigger the useEffect with exit code
      rerender(<RalphControls />);

      // Wait for microtask to complete
      await waitFor(() => {
        const status = screen.queryByTestId('status-text');
        expect(status).toHaveTextContent('Completed');
      });
    });

    it('should show Failed status for non-zero exit code', async () => {
      const { rerender } = render(<RalphControls />);

      // Start a process
      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Mock exit code 1
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          exitCode: 1,
          connectionStatus: 'disconnected',
        }),
      );

      rerender(<RalphControls />);

      await waitFor(() => {
        const status = screen.queryByTestId('status-text');
        expect(status).toHaveTextContent('Failed (code 1)');
      });
    });

    it('should show Clear button after process completes', async () => {
      const { rerender } = render(<RalphControls />);

      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          exitCode: 0,
          connectionStatus: 'disconnected',
        }),
      );

      rerender(<RalphControls />);

      await waitFor(() => {
        expect(screen.getByTestId('clear-output')).toBeInTheDocument();
      });
    });

    it('should clear output panel when Clear is clicked', async () => {
      const { rerender } = render(<RalphControls />);

      const runButton = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(runButton);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          exitCode: 0,
          connectionStatus: 'disconnected',
        }),
      );

      rerender(<RalphControls />);

      // Wait for exit to be processed
      await waitFor(() => {
        expect(screen.getByTestId('clear-output')).toBeInTheDocument();
      });

      // Click clear
      const clearButton = screen.getByTestId('clear-output');
      fireEvent.click(clearButton);

      // Output panel should be hidden now
      expect(screen.queryByTestId('toggle-output')).not.toBeInTheDocument();
    });
  });

  describe('button states', () => {
    it('should disable Run buttons when process is running', () => {
      render(<RalphControls />);

      // Start a process
      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Both buttons should be disabled when a process is running
      expect(screen.getByTestId('run-once-button')).toBeDisabled();
      expect(screen.getByTestId('run-all-button')).toBeDisabled();
    });
  });

  describe('connection status', () => {
    it('should show connection status when process is running', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          connectionStatus: 'connected',
          isConnected: true,
        }),
      );

      render(<RalphControls />);

      // Start a process
      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Use getAllByText since both RalphControls and ProcessOutputViewer show connection status
      const connectedTexts = screen.getAllByText('Connected');
      expect(connectedTexts.length).toBeGreaterThan(0);
    });

    it('should show Connecting status', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          connectionStatus: 'connecting',
        }),
      );

      render(<RalphControls />);

      // Start a process
      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Use getAllByText since both RalphControls and ProcessOutputViewer show connection status
      const connectingTexts = screen.getAllByText('Connecting...');
      expect(connectingTexts.length).toBeGreaterThan(0);
    });
  });

  describe('hook integration', () => {
    it('should call useProcessOutput with null initially', () => {
      render(<RalphControls />);
      expect(mockUseProcessOutput).toHaveBeenCalledWith(null);
    });

    it('should call useProcessOutput with process id after starting', () => {
      render(<RalphControls />);

      // Start a process
      const button = screen.getByRole('button', { name: 'Run Next Ticket' });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Check that useProcessOutput was called with the new process id
      expect(mockUseProcessOutput).toHaveBeenCalledWith('test-proc-id');
    });
  });
});
