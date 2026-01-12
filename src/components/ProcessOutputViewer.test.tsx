import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProcessOutputViewer } from './ProcessOutputViewer';
import type { ProcessOutputLine } from '@/lib/process-runner';
import type { ConnectionStatus } from '@/hooks/use-event-stream';

interface Props {
  lines?: ProcessOutputLine[];
  exitCode?: number | null;
  connectionStatus?: ConnectionStatus;
  processId?: string | null;
  height?: string;
  title?: string;
  showCard?: boolean;
  initialAutoScroll?: boolean;
}

function renderComponent(props: Props = {}) {
  const defaultProps = {
    lines: [],
    exitCode: null,
    connectionStatus: 'disconnected' as ConnectionStatus,
    processId: null,
    ...props,
  };
  return render(<ProcessOutputViewer {...defaultProps} />);
}

describe('ProcessOutputViewer', () => {
  describe('rendering', () => {
    it('should render without crashing', () => {
      const { container } = renderComponent();
      expect(container).toBeTruthy();
    });

    it('should show "No process selected" when processId is null', () => {
      renderComponent();
      expect(screen.getByText('No process selected')).toBeInTheDocument();
    });

    it('should show "Connecting to process..." when connecting', () => {
      renderComponent({
        processId: 'test-id',
        connectionStatus: 'connecting',
      });
      expect(screen.getByText('Connecting to process...')).toBeInTheDocument();
    });

    it('should show "No output yet" when disconnected with no lines', () => {
      renderComponent({
        processId: 'test-id',
        connectionStatus: 'disconnected',
      });
      expect(screen.getByText('No output yet')).toBeInTheDocument();
    });

    it('should render output lines', () => {
      const lines: ProcessOutputLine[] = [
        { stream: 'stdout', line: 'Hello World', timestamp: 1000 },
        { stream: 'stdout', line: 'Second line', timestamp: 2000 },
      ];

      renderComponent({
        lines,
        processId: 'test-id',
        connectionStatus: 'connected',
      });
      expect(screen.getByText('Hello World')).toBeInTheDocument();
      expect(screen.getByText('Second line')).toBeInTheDocument();
    });

    it('should render stderr lines in destructive color', () => {
      const lines: ProcessOutputLine[] = [
        { stream: 'stderr', line: 'Error message', timestamp: 1000 },
      ];

      renderComponent({
        lines,
        processId: 'test-id',
        connectionStatus: 'connected',
      });
      const errorLine = screen.getByText('Error message');
      expect(errorLine).toHaveClass('text-destructive');
    });

    it('should render stdout lines without destructive color', () => {
      const lines: ProcessOutputLine[] = [
        { stream: 'stdout', line: 'Normal output', timestamp: 1000 },
      ];

      renderComponent({
        lines,
        processId: 'test-id',
        connectionStatus: 'connected',
      });
      const normalLine = screen.getByText('Normal output');
      expect(normalLine).not.toHaveClass('text-destructive');
    });
  });

  describe('exit code display', () => {
    it('should show exit code when process exits successfully', () => {
      renderComponent({
        lines: [{ stream: 'stdout', line: 'Done', timestamp: 1000 }],
        exitCode: 0,
        processId: 'test-id',
        connectionStatus: 'disconnected',
      });
      expect(
        screen.getByText('Process exited with code 0'),
      ).toBeInTheDocument();
    });

    it('should show exit code when process exits with error', () => {
      renderComponent({
        lines: [{ stream: 'stderr', line: 'Failed', timestamp: 1000 }],
        exitCode: 1,
        processId: 'test-id',
        connectionStatus: 'disconnected',
      });
      expect(
        screen.getByText('Process exited with code 1'),
      ).toBeInTheDocument();
    });

    it('should apply green color for exit code 0', () => {
      renderComponent({
        lines: [{ stream: 'stdout', line: 'Done', timestamp: 1000 }],
        exitCode: 0,
        processId: 'test-id',
        connectionStatus: 'disconnected',
      });
      const exitMessage = screen.getByText('Process exited with code 0');
      expect(exitMessage).toHaveClass('text-green-600');
    });

    it('should apply destructive color for non-zero exit code', () => {
      renderComponent({
        lines: [{ stream: 'stderr', line: 'Failed', timestamp: 1000 }],
        exitCode: 1,
        processId: 'test-id',
        connectionStatus: 'disconnected',
      });
      const exitMessage = screen.getByText('Process exited with code 1');
      expect(exitMessage).toHaveClass('text-destructive');
    });
  });

  describe('connection status badge', () => {
    it('should show Connected badge when connected', () => {
      renderComponent({
        processId: 'test-id',
        connectionStatus: 'connected',
      });
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should show Connecting badge when connecting', () => {
      renderComponent({
        processId: 'test-id',
        connectionStatus: 'connecting',
      });
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should show Disconnected badge when disconnected', () => {
      renderComponent({
        processId: 'test-id',
        connectionStatus: 'disconnected',
      });
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should not show badge when no processId', () => {
      renderComponent();
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
      expect(screen.queryByText('Connecting...')).not.toBeInTheDocument();
      expect(screen.queryByText('Disconnected')).not.toBeInTheDocument();
    });
  });

  describe('auto-scroll toggle', () => {
    it('should show auto-scroll button', () => {
      renderComponent({ processId: 'test-id' });
      expect(screen.getByText('Auto-scroll: On')).toBeInTheDocument();
    });

    it('should toggle auto-scroll on click', () => {
      renderComponent({ processId: 'test-id' });

      const button = screen.getByText('Auto-scroll: On');
      fireEvent.click(button);

      expect(screen.getByText('Auto-scroll: Off')).toBeInTheDocument();
    });

    it('should respect initialAutoScroll prop', () => {
      renderComponent({ processId: 'test-id', initialAutoScroll: false });
      expect(screen.getByText('Auto-scroll: Off')).toBeInTheDocument();
    });
  });

  describe('customization', () => {
    it('should use custom title', () => {
      renderComponent({ title: 'Custom Title' });
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should apply custom height', () => {
      renderComponent({ height: '500px' });
      const scrollArea = document.querySelector('[style*="height: 500px"]');
      expect(scrollArea).toBeInTheDocument();
    });

    it('should render without card when showCard is false', () => {
      const { container } = renderComponent({ showCard: false });
      const card = container.querySelector('.rounded-lg.border');
      expect(card).not.toBeInTheDocument();
    });
  });
});
