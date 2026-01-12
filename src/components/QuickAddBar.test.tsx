import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuickAddBar } from './QuickAddBar';

// Mock the hooks and modules
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock tRPC
const mockCreateMutate = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpc: {
    tickets: {
      create: {
        useMutation: vi.fn(() => ({
          mutate: mockCreateMutate,
          isPending: false,
        })),
      },
    },
    useUtils: () => ({
      tickets: {
        list: {
          invalidate: vi.fn(),
        },
      },
    }),
  },
}));

describe('QuickAddBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('quick add functionality', () => {
    it('should render input field', () => {
      render(<QuickAddBar />);
      expect(
        screen.getByPlaceholderText('Quick add (Enter = draft)'),
      ).toBeInTheDocument();
    });

    it('should create draft ticket on Enter', () => {
      render(<QuickAddBar />);

      const input = screen.getByPlaceholderText('Quick add (Enter = draft)');
      fireEvent.change(input, { target: { value: 'My new ticket' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockCreateMutate).toHaveBeenCalledWith({
        title: 'My new ticket',
        status: 'draft',
      });
    });

    it('should create pending ticket on Shift+Enter', () => {
      render(<QuickAddBar />);

      const input = screen.getByPlaceholderText('Quick add (Enter = draft)');
      fireEvent.change(input, { target: { value: 'My pending ticket' } });
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      expect(mockCreateMutate).toHaveBeenCalledWith({
        title: 'My pending ticket',
        status: 'pending',
      });
    });
  });

  describe('expand to full form', () => {
    it('should show expand button', () => {
      render(<QuickAddBar />);
      expect(screen.getByTitle('Expand full form')).toBeInTheDocument();
    });

    it('should show AddTicketForm when expanded', () => {
      render(<QuickAddBar />);

      const expandButton = screen.getByTitle('Expand full form');
      fireEvent.click(expandButton);

      // AddTicketForm has a "Title" label
      expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    });

    it('should pass entered title to AddTicketForm when expanded', () => {
      render(<QuickAddBar />);

      // Type into quick add input
      const input = screen.getByPlaceholderText('Quick add (Enter = draft)');
      fireEvent.change(input, { target: { value: 'My prefilled title' } });

      // Click expand button
      const expandButton = screen.getByTitle('Expand full form');
      fireEvent.click(expandButton);

      // The AddTicketForm title input should have the prefilled value
      const titleInput = screen.getByLabelText(/Title/) as HTMLInputElement;
      expect(titleInput.value).toBe('My prefilled title');
    });

    it('should clear quick add input when expanding with prefilled title', () => {
      render(<QuickAddBar />);

      // Type into quick add input
      const input = screen.getByPlaceholderText('Quick add (Enter = draft)');
      fireEvent.change(input, { target: { value: 'My prefilled title' } });

      // Click expand button
      const expandButton = screen.getByTitle('Expand full form');
      fireEvent.click(expandButton);

      // After collapsing back, the quick add input should be cleared
      const collapseButton = screen.getByRole('button', { name: '' }); // ChevronUp button
      fireEvent.click(collapseButton);

      const quickAddInput = screen.getByPlaceholderText(
        'Quick add (Enter = draft)',
      ) as HTMLInputElement;
      expect(quickAddInput.value).toBe('');
    });

    it('should have scrollable expanded form for mobile viewports', () => {
      render(<QuickAddBar />);

      // Click expand button
      const expandButton = screen.getByTitle('Expand full form');
      fireEvent.click(expandButton);

      // The expanded form container should have max-height and overflow classes
      const expandedContainer = screen.getByText('New Ticket').closest('div');
      expect(expandedContainer?.parentElement).toHaveClass('overflow-y-auto');
      expect(expandedContainer?.parentElement).toHaveClass('max-h-[50vh]');
    });
  });
});
