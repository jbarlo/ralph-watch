import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RalphSidePanel } from './RalphSidePanel';
import type { UseEventStreamResult } from '@/hooks/use-event-stream';

// Mock the hooks and modules
vi.mock('@/hooks/use-event-stream', () => ({
  useEventStream: vi.fn(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/components/providers/TRPCProvider', () => ({
  useProjectPath: () => '/test/project',
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

const mockConfig = {
  commands: [
    { label: 'Run Next', cmd: 'ralph-once', icon: 'play' },
    { label: 'Run All', cmd: 'ralph', icon: 'zap' },
  ],
};

const mockRefetch = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    config: {
      get: {
        useQuery: vi.fn(() => ({
          data: mockConfig,
          isLoading: false,
          error: null,
        })),
      },
    },
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
      status: {
        useQuery: vi.fn(() => ({
          data: null,
          refetch: mockRefetch,
        })),
      },
      list: {
        useQuery: vi.fn(() => ({
          data: [],
          isLoading: false,
          error: null,
        })),
      },
    },
  },
}));

// Import mocked modules
import { useEventStream } from '@/hooks/use-event-stream';
const mockUseEventStream = vi.mocked(useEventStream);

// Helper to create mock hook result
function createMockResult(
  overrides: Partial<UseEventStreamResult> = {},
): UseEventStreamResult {
  return {
    connectionStatus: 'disconnected',
    subscribe: vi.fn(() => () => {}),
    ...overrides,
  };
}

describe('RalphSidePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseEventStream.mockReturnValue(createMockResult());
    mockRefetch.mockResolvedValue({ data: null });
    startMutationOptions = {};
    killMutationOptions = {};
  });

  describe('initial rendering', () => {
    it('should render Run Next button', () => {
      render(<RalphSidePanel />);
      expect(
        screen.getByRole('button', { name: /Run Next/i }),
      ).toBeInTheDocument();
    });

    it('should render Run All button', () => {
      render(<RalphSidePanel />);
      expect(
        screen.getByRole('button', { name: /Run All/i }),
      ).toBeInTheDocument();
    });

    it('should not show Stop button initially', () => {
      render(<RalphSidePanel />);
      expect(
        screen.queryByRole('button', { name: 'Stop' }),
      ).not.toBeInTheDocument();
    });

    it('should show empty output message initially', () => {
      render(<RalphSidePanel />);
      expect(
        screen.getByText('No output yet. Run a command to see output.'),
      ).toBeInTheDocument();
    });
  });

  describe('starting processes', () => {
    it('should call start mutation with ralph-once on Run Next click', () => {
      render(<RalphSidePanel />);

      const button = screen.getByRole('button', { name: /Run Next/i });
      fireEvent.click(button);

      expect(mockStartMutate).toHaveBeenCalledWith({ command: 'ralph-once' });
    });

    it('should call start mutation with ralph on Run All click', () => {
      render(<RalphSidePanel />);

      const button = screen.getByRole('button', { name: /Run All/i });
      fireEvent.click(button);

      expect(mockStartMutate).toHaveBeenCalledWith({ command: 'ralph' });
    });
  });

  describe('running state', () => {
    it('should show status text when process is running', () => {
      render(<RalphSidePanel />);

      // Click to start
      const button = screen.getByRole('button', { name: /Run Next/i });
      fireEvent.click(button);

      // Simulate successful start
      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Should show running status with label from config
      expect(screen.getByTestId('status-text')).toHaveTextContent(
        'Running: Run Next...',
      );
    });

    it('should show output panel when process is started', () => {
      render(<RalphSidePanel />);

      const button = screen.getByRole('button', { name: /Run Next/i });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Output panel is shown automatically - check for the Output title
      expect(screen.getByText('Output')).toBeInTheDocument();
    });

    it('should show Stop button when process is running', () => {
      render(<RalphSidePanel />);

      const button = screen.getByRole('button', { name: /Run Next/i });
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
      render(<RalphSidePanel />);

      // Start a process
      const runButton = screen.getByRole('button', { name: /Run Next/i });
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

  describe('panel collapse', () => {
    it('should toggle panel visibility when clicking collapse button', () => {
      render(<RalphSidePanel />);

      // Panel should be expanded initially with "Ralph Controls" title
      expect(screen.getByText('Ralph Controls')).toBeInTheDocument();

      // Find collapse button (shows ») and click to collapse
      const collapseButton = screen.getByTitle('Collapse panel');
      fireEvent.click(collapseButton);

      // Panel is now collapsed - "Ralph Controls" title should be hidden
      expect(screen.queryByText('Ralph Controls')).not.toBeInTheDocument();

      // Find expand button (shows «) and click to expand
      const expandButton = screen.getByTitle('Expand panel');
      fireEvent.click(expandButton);

      // Panel should be expanded again
      expect(screen.getByText('Ralph Controls')).toBeInTheDocument();
    });
  });

  describe('button states', () => {
    it('should disable Run buttons when process is running', () => {
      render(<RalphSidePanel />);

      // Start a process
      const button = screen.getByRole('button', { name: /Run Next/i });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Both buttons should be disabled when a process is running
      expect(screen.getByTestId('command-button-0')).toBeDisabled();
      expect(screen.getByTestId('command-button-1')).toBeDisabled();
    });
  });

  describe('connection status', () => {
    it('should show connection status when process is running', () => {
      mockUseEventStream.mockReturnValue(
        createMockResult({
          connectionStatus: 'connected',
        }),
      );

      render(<RalphSidePanel />);

      // Start a process
      const button = screen.getByRole('button', { name: /Run Next/i });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Use getAllByText since both status area and ProcessOutputViewer show connection status
      const connectedTexts = screen.getAllByText('Connected');
      expect(connectedTexts.length).toBeGreaterThan(0);
    });

    it('should show Connecting status', () => {
      mockUseEventStream.mockReturnValue(
        createMockResult({
          connectionStatus: 'connecting',
        }),
      );

      render(<RalphSidePanel />);

      // Start a process
      const button = screen.getByRole('button', { name: /Run Next/i });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Use getAllByText since both status area and ProcessOutputViewer show connection status
      const connectingTexts = screen.getAllByText('Connecting...');
      expect(connectingTexts.length).toBeGreaterThan(0);
    });
  });

  describe('useEventStream integration', () => {
    it('should call useEventStream with project path', () => {
      render(<RalphSidePanel />);
      expect(mockUseEventStream).toHaveBeenCalledWith(
        expect.objectContaining({
          project: '/test/project',
        }),
      );
    });

    it('should include process topic when process is running', () => {
      render(<RalphSidePanel />);

      // Start a process
      const button = screen.getByRole('button', { name: /Run Next/i });
      fireEvent.click(button);

      act(() => {
        startMutationOptions.onSuccess?.(
          { id: 'test-proc-id', pid: 12345 },
          { command: 'ralph-once' },
        );
      });

      // Check that useEventStream was called with the process topic
      expect(mockUseEventStream).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: expect.arrayContaining(['process:test-proc-id']),
        }),
      );
    });
  });
});
