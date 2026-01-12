'use client';

import { useSyncExternalStore, useCallback } from 'react';

function subscribe(query: string, callback: () => void): () => void {
  const mediaQuery = window.matchMedia(query);
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getSnapshot(query: string): boolean {
  return window.matchMedia(query).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Hook to detect if a media query matches
 * Returns false during SSR to avoid hydration mismatch
 */
export function useMediaQuery(query: string): boolean {
  const subscribeFn = useCallback(
    (callback: () => void) => subscribe(query, callback),
    [query],
  );
  const getSnapshotFn = useCallback(() => getSnapshot(query), [query]);

  return useSyncExternalStore(subscribeFn, getSnapshotFn, getServerSnapshot);
}

/**
 * Hook to detect if the viewport is mobile-sized (< 768px)
 */
export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 768px)');
}
