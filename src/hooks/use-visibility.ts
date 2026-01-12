'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type VisibilityState = 'visible' | 'hidden';

export interface UseVisibilityResult {
  isVisible: boolean;
  visibilityState: VisibilityState;
  onBecomeVisible: (callback: () => void) => () => void;
}

export function useVisibility(): UseVisibilityResult {
  const [visibilityState, setVisibilityState] =
    useState<VisibilityState>('visible');

  const callbacksRef = useRef(new Set<() => void>());

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      const newState: VisibilityState =
        document.visibilityState === 'visible' ? 'visible' : 'hidden';

      setVisibilityState((prevState) => {
        if (prevState === 'hidden' && newState === 'visible') {
          for (const callback of callbacksRef.current) {
            callback();
          }
        }
        return newState;
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const onBecomeVisible = useCallback((callback: () => void): (() => void) => {
    callbacksRef.current.add(callback);
    return () => {
      callbacksRef.current.delete(callback);
    };
  }, []);

  return {
    isVisible: visibilityState === 'visible',
    visibilityState,
    onBecomeVisible,
  };
}
