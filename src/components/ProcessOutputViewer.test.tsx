import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProcessOutputViewer } from './ProcessOutputViewer';
import type { UseProcessOutputResult } from '@/hooks/use-process-output';
import type { ProcessOutputLine } from '@/lib/process-runner';

// Mock the useProcessOutput hook
vi.mock('@/hooks/use-process-output', () => ({
  useProcessOutput: vi.fn(),
}));

// Import the mocked module
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

describe('ProcessOutputViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProcessOutput.mockReturnValue(createMockResult());
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<ProcessOutputViewer processId={null} />);
      expect(container).toBeTruthy();
    });

    it('should show "No process selected" when processId is null', () => {
      render(<ProcessOutputViewer processId={null} />);
      expect(screen.getByText('No process selected')).toBeInTheDocument();
    });

    it('should show "Connecting to process..." when connecting', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          connectionStatus: 'connecting',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      expect(screen.getByText('Connecting to process...')).toBeInTheDocument();
    });

    it('should show "No output yet" when disconnected with no lines', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          connectionStatus: 'disconnected',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      expect(screen.getByText('No output yet')).toBeInTheDocument();
    });

    it('should render output lines', () => {
      const lines: ProcessOutputLine[] = [
        { stream: 'stdout', line: 'Hello World', timestamp: 1000 },
        { stream: 'stdout', line: 'Second line', timestamp: 2000 },
      ];

      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          lines,
          connectionStatus: 'connected',
          isConnected: true,
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      expect(screen.getByText('Hello World')).toBeInTheDocument();
      expect(screen.getByText('Second line')).toBeInTheDocument();
    });

    it('should render stderr lines in destructive color', () => {
      const lines: ProcessOutputLine[] = [
        { stream: 'stderr', line: 'Error message', timestamp: 1000 },
      ];

      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          lines,
          connectionStatus: 'connected',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      const errorLine = screen.getByText('Error message');
      expect(errorLine).toHaveClass('text-destructive');
    });

    it('should render stdout lines without destructive color', () => {
      const lines: ProcessOutputLine[] = [
        { stream: 'stdout', line: 'Normal output', timestamp: 1000 },
      ];

      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          lines,
          connectionStatus: 'connected',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      const normalLine = screen.getByText('Normal output');
      expect(normalLine).not.toHaveClass('text-destructive');
    });
  });

  describe('exit code display', () => {
    it('should show exit code when process exits successfully', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          lines: [{ stream: 'stdout', line: 'Done', timestamp: 1000 }],
          exitCode: 0,
          connectionStatus: 'disconnected',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      expect(
        screen.getByText('Process exited with code 0'),
      ).toBeInTheDocument();
    });

    it('should show exit code when process exits with error', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          lines: [{ stream: 'stderr', line: 'Failed', timestamp: 1000 }],
          exitCode: 1,
          connectionStatus: 'disconnected',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      expect(
        screen.getByText('Process exited with code 1'),
      ).toBeInTheDocument();
    });

    it('should apply green color for exit code 0', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          lines: [{ stream: 'stdout', line: 'Done', timestamp: 1000 }],
          exitCode: 0,
          connectionStatus: 'disconnected',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      const exitMessage = screen.getByText('Process exited with code 0');
      expect(exitMessage).toHaveClass('text-green-600');
    });

    it('should apply destructive color for non-zero exit code', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          lines: [{ stream: 'stderr', line: 'Failed', timestamp: 1000 }],
          exitCode: 1,
          connectionStatus: 'disconnected',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      const exitMessage = screen.getByText('Process exited with code 1');
      expect(exitMessage).toHaveClass('text-destructive');
    });
  });

  describe('connection status badge', () => {
    it('should show Connected badge when connected', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          connectionStatus: 'connected',
          isConnected: true,
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should show Connecting badge when connecting', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          connectionStatus: 'connecting',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should show Disconnected badge when disconnected', () => {
      mockUseProcessOutput.mockReturnValue(
        createMockResult({
          connectionStatus: 'disconnected',
        }),
      );

      render(<ProcessOutputViewer processId="test-id" />);
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should not show badge when no processId', () => {
      render(<ProcessOutputViewer processId={null} />);
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
      expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
      expect(screen.queryByText('Disconnected')).not.toBeInTheDocument();
    });
  });

  describe('auto-scroll toggle', () => {
    it('should show auto-scroll button', () => {
      render(<ProcessOutputViewer processId="test-id" />);
      expect(screen.getByText('Auto-scroll: On')).toBeInTheDocument();
    });

    it('should toggle auto-scroll on click', () => {
      render(<ProcessOutputViewer processId="test-id" />);

      const button = screen.getByText('Auto-scroll: On');
      fireEvent.click(button);

      expect(screen.getByText('Auto-scroll: Off')).toBeInTheDocument();
    });

    it('should respect initialAutoScroll prop', () => {
      render(
        <ProcessOutputViewer processId="test-id" initialAutoScroll={false} />,
      );
      expect(screen.getByText('Auto-scroll: Off')).toBeInTheDocument();
    });
  });

  describe('customization', () => {
    it('should use custom title', () => {
      render(<ProcessOutputViewer processId={null} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should apply custom height', () => {
      render(<ProcessOutputViewer processId={null} height="500px" />);
      // The ScrollArea should have the custom height style
      const scrollArea = document.querySelector('[style*="height: 500px"]');
      expect(scrollArea).toBeInTheDocument();
    });

    it('should render without card when showCard is false', () => {
      const { container } = render(
        <ProcessOutputViewer processId={null} showCard={false} />,
      );
      // Should not have Card structure (no card-specific classes in outer wrapper)
      const card = container.querySelector('.rounded-lg.border');
      expect(card).not.toBeInTheDocument();
    });
  });

  describe('hook integration', () => {
    it('should call useProcessOutput with correct processId', () => {
      render(<ProcessOutputViewer processId="my-process-id" />);
      expect(mockUseProcessOutput).toHaveBeenCalledWith('my-process-id');
    });

    it('should call useProcessOutput with null when processId is null', () => {
      render(<ProcessOutputViewer processId={null} />);
      expect(mockUseProcessOutput).toHaveBeenCalledWith(null);
    });

    it('should call useProcessOutput with undefined when processId is undefined', () => {
      render(<ProcessOutputViewer processId={undefined} />);
      expect(mockUseProcessOutput).toHaveBeenCalledWith(undefined);
    });
  });
});
