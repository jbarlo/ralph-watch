import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionTabs } from './SessionTabs';
import type { SessionInfo } from '@/hooks/use-terminal';

describe('SessionTabs', () => {
  const mockSessions: SessionInfo[] = [
    {
      id: 'session-1',
      label: 'Main',
      pid: 1234,
      createdAt: Date.now() - 10000,
    },
    {
      id: 'session-2',
      label: 'Ticket #42',
      pid: 5678,
      createdAt: Date.now() - 5000,
    },
    { id: 'session-3', label: 'Debug', pid: 9012, createdAt: Date.now() },
  ];

  const mockHandlers = {
    onSelectSession: vi.fn(),
    onCloseSession: vi.fn(),
    onNewSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('shows new session button when no sessions', () => {
      render(
        <SessionTabs sessions={[]} activeSessionId={null} {...mockHandlers} />,
      );

      expect(screen.getByText('New Session')).toBeInTheDocument();
    });

    it('calls onNewSession when clicking new session button in empty state', () => {
      render(
        <SessionTabs sessions={[]} activeSessionId={null} {...mockHandlers} />,
      );

      fireEvent.click(screen.getByText('New Session'));
      expect(mockHandlers.onNewSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('with sessions', () => {
    it('renders all session tabs', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      expect(screen.getByText('Main')).toBeInTheDocument();
      expect(screen.getByText('Ticket #42')).toBeInTheDocument();
      expect(screen.getByText('Debug')).toBeInTheDocument();
    });

    it('highlights active tab', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-2"
          {...mockHandlers}
        />,
      );

      const activeTab = screen.getByRole('tab', { selected: true });
      expect(activeTab).toHaveTextContent('Ticket #42');
    });

    it('calls onSelectSession when clicking a tab', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      fireEvent.click(screen.getByText('Debug'));
      expect(mockHandlers.onSelectSession).toHaveBeenCalledWith('session-3');
    });

    it('shows close button on tabs when more than one session', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      expect(closeButtons.length).toBe(3);
    });

    it('hides close button when only one session', () => {
      render(
        <SessionTabs
          sessions={[mockSessions[0]!]}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      const closeButtons = screen.queryAllByRole('button', { name: /close/i });
      expect(closeButtons.length).toBe(0);
    });

    it('calls onCloseSession when clicking close button', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      const closeButtons = screen.getAllByRole('button', { name: /close/i });
      fireEvent.click(closeButtons[1]!);
      expect(mockHandlers.onCloseSession).toHaveBeenCalledWith('session-2');
    });

    it('calls onNewSession when clicking + button', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'New session' }));
      expect(mockHandlers.onNewSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('keyboard navigation', () => {
    it('navigates to next tab on ArrowRight', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      const activeTab = screen.getByRole('tab', { selected: true });
      fireEvent.keyDown(activeTab, { key: 'ArrowRight' });
      expect(mockHandlers.onSelectSession).toHaveBeenCalledWith('session-2');
    });

    it('navigates to previous tab on ArrowLeft', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-2"
          {...mockHandlers}
        />,
      );

      const activeTab = screen.getByRole('tab', { selected: true });
      fireEvent.keyDown(activeTab, { key: 'ArrowLeft' });
      expect(mockHandlers.onSelectSession).toHaveBeenCalledWith('session-1');
    });

    it('wraps to first tab on ArrowRight from last', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-3"
          {...mockHandlers}
        />,
      );

      const activeTab = screen.getByRole('tab', { selected: true });
      fireEvent.keyDown(activeTab, { key: 'ArrowRight' });
      expect(mockHandlers.onSelectSession).toHaveBeenCalledWith('session-1');
    });

    it('wraps to last tab on ArrowLeft from first', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      const activeTab = screen.getByRole('tab', { selected: true });
      fireEvent.keyDown(activeTab, { key: 'ArrowLeft' });
      expect(mockHandlers.onSelectSession).toHaveBeenCalledWith('session-3');
    });

    it('navigates to first tab on Home', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-3"
          {...mockHandlers}
        />,
      );

      const activeTab = screen.getByRole('tab', { selected: true });
      fireEvent.keyDown(activeTab, { key: 'Home' });
      expect(mockHandlers.onSelectSession).toHaveBeenCalledWith('session-1');
    });

    it('navigates to last tab on End', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      const activeTab = screen.getByRole('tab', { selected: true });
      fireEvent.keyDown(activeTab, { key: 'End' });
      expect(mockHandlers.onSelectSession).toHaveBeenCalledWith('session-3');
    });
  });

  describe('accessibility', () => {
    it('has proper tablist role', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('has proper tab roles', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toBe(3);
    });

    it('marks only active tab as selected', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-2"
          {...mockHandlers}
        />,
      );

      const tabs = screen.getAllByRole('tab');
      const selectedTab = tabs.find(
        (tab) => tab.getAttribute('aria-selected') === 'true',
      );
      expect(selectedTab).toHaveTextContent('Ticket #42');
    });

    it('sets proper tabindex for roving tabindex pattern', () => {
      render(
        <SessionTabs
          sessions={mockSessions}
          activeSessionId="session-2"
          {...mockHandlers}
        />,
      );

      const tabs = screen.getAllByRole('tab');
      const activeTab = tabs.find(
        (tab) => tab.getAttribute('aria-selected') === 'true',
      );
      const inactiveTabs = tabs.filter(
        (tab) => tab.getAttribute('aria-selected') !== 'true',
      );

      expect(activeTab).toHaveAttribute('tabindex', '0');
      inactiveTabs.forEach((tab) => {
        expect(tab).toHaveAttribute('tabindex', '-1');
      });
    });
  });

  describe('session without label', () => {
    it('shows "Session" as fallback label', () => {
      const sessionsWithoutLabel: SessionInfo[] = [
        { id: 'session-1', label: '', pid: 1234, createdAt: Date.now() },
      ];

      render(
        <SessionTabs
          sessions={sessionsWithoutLabel}
          activeSessionId="session-1"
          {...mockHandlers}
        />,
      );

      expect(screen.getByText('Session')).toBeInTheDocument();
    });
  });
});
