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
 * Subscribe to permission changes (no-op, permission doesn't have events)
 */
function subscribeToPermission(): () => void {
  // Notification permission doesn't emit events for changes
  // We'll update when requestPermission resolves
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
  // Use useSyncExternalStore for SSR-safe permission access
  const currentPermission = useSyncExternalStore(
    subscribeToPermission,
    getNotificationPermission,
    () => 'default' as NotificationPermission, // Server snapshot
  );

  const [permission, setPermission] =
    useState<NotificationPermission>(currentPermission);
  const [isTabFocused, setIsTabFocused] = useState(true);

  // Request notification permission on mount
  useEffect(() => {
    // Check if notifications are supported
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return;
    }

    // Request permission if not already granted or denied
    if (Notification.permission === 'default') {
      void Notification.requestPermission().then((result) => {
        setPermission(result as NotificationPermission);
      });
    }
  }, []);

  // Track tab focus state
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

  /**
   * Show a notification if permission is granted and tab is not focused
   */
  const showNotification = useCallback(
    (options: NotificationOptions): boolean => {
      // Check if notifications are supported and permitted
      if (typeof window === 'undefined' || !('Notification' in window)) {
        return false;
      }

      if (permission !== 'granted') {
        return false;
      }

      // Only show if tab is not focused
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

  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  return {
    permission,
    isTabFocused,
    showNotification,
    isSupported,
  };
}
