'use client';

import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';

/**
 * Notification permission state
 */
export type NotificationPermission = 'default' | 'granted' | 'denied';

/**
 * Options for showing a notification
 */
export interface NotificationOptions {
  title: string;
  body?: string;
  icon?: string;
  tag?: string;
}

/**
 * Get current notification permission
 */
function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'default';
  }
  return Notification.permission as NotificationPermission;
}

/**
 * No-op subscription: Notification.permission doesn't emit change events.
 * Updates happen via requestPermission promise resolution.
 */
function subscribeToPermission(): () => void {
  return () => {};
}

/**
 * Get notification support status (client-side only)
 */
function getIsSupportedSnapshot(): boolean {
  return 'Notification' in window;
}

/**
 * Server-side snapshot for isSupported (always false for hydration match)
 */
function getIsSupportedServerSnapshot(): boolean {
  return false;
}

function subscribeToSupport(): () => void {
  return () => {};
}

/**
 * Hook for managing browser notifications
 *
 * - Requests permission on mount
 * - Provides function to show notifications
 * - Only shows notifications when tab is not focused
 *
 * @returns Permission state and showNotification function
 */
export function useNotifications() {
  const currentPermission = useSyncExternalStore(
    subscribeToPermission,
    getNotificationPermission,
    () => 'default' as NotificationPermission,
  );

  const [permission, setPermission] =
    useState<NotificationPermission>(currentPermission);
  const [isTabFocused, setIsTabFocused] = useState(true);

  const isSupported = useSyncExternalStore(
    subscribeToSupport,
    getIsSupportedSnapshot,
    getIsSupportedServerSnapshot,
  );

  useEffect(() => {
    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'default') {
      void Notification.requestPermission().then((result) => {
        setPermission(result as NotificationPermission);
      });
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      setIsTabFocused(!document.hidden);
    };

    const handleFocus = () => setIsTabFocused(true);
    const handleBlur = () => setIsTabFocused(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const showNotification = useCallback(
    (options: NotificationOptions): boolean => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        return false;
      }

      if (permission !== 'granted') {
        return false;
      }

      if (isTabFocused) {
        return false;
      }

      try {
        new Notification(options.title, {
          body: options.body,
          icon: options.icon ?? '/favicon.ico',
          tag: options.tag,
        });
        return true;
      } catch (error) {
        console.error('[useNotifications] Failed to show notification:', error);
        return false;
      }
    },
    [permission, isTabFocused],
  );

  return {
    permission,
    isTabFocused,
    showNotification,
    isSupported,
  };
}
