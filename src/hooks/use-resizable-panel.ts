'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';

interface ResizablePanelConfig {
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  collapsedWidth?: number;
}

interface PanelState {
  width: number;
  isCollapsed: boolean;
}

type PanelStore = {
  listeners: Set<() => void>;
  state: PanelState;
};

const stores = new Map<string, PanelStore>();

function getOrCreateStore(config: ResizablePanelConfig): PanelStore {
  let store = stores.get(config.storageKey);
  if (!store) {
    const stored = getStoredState(config);
    store = {
      listeners: new Set(),
      state: stored,
    };
    stores.set(config.storageKey, store);
  }
  return store;
}

function getStoredState(config: ResizablePanelConfig): PanelState {
  if (typeof window === 'undefined') {
    return { width: config.defaultWidth, isCollapsed: false };
  }
  try {
    const stored = localStorage.getItem(config.storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as PanelState;
      return {
        width: Math.min(
          Math.max(parsed.width ?? config.defaultWidth, config.minWidth),
          config.maxWidth,
        ),
        isCollapsed: parsed.isCollapsed ?? false,
      };
    }
  } catch {
    // localStorage unavailable or invalid data
  }
  return { width: config.defaultWidth, isCollapsed: false };
}

function saveState(config: ResizablePanelConfig, state: PanelState): void {
  try {
    localStorage.setItem(config.storageKey, JSON.stringify(state));
  } catch {
    // localStorage unavailable
  }
}

function setStoreWidth(
  storageKey: string,
  config: ResizablePanelConfig,
  width: number,
): void {
  const store = stores.get(storageKey);
  if (!store) return;
  const clamped = Math.min(Math.max(width, config.minWidth), config.maxWidth);
  store.state = { ...store.state, width: clamped };
  saveState(config, store.state);
  store.listeners.forEach((cb) => cb());
}

function setStoreCollapsed(
  storageKey: string,
  config: ResizablePanelConfig,
  collapsed: boolean,
): void {
  const store = stores.get(storageKey);
  if (!store) return;
  store.state = { ...store.state, isCollapsed: collapsed };
  saveState(config, store.state);
  store.listeners.forEach((cb) => cb());
}

function getStoreState(storageKey: string): PanelState | null {
  return stores.get(storageKey)?.state ?? null;
}

export function useResizablePanel(config: ResizablePanelConfig) {
  getOrCreateStore(config);

  const subscribe = useCallback(
    (callback: () => void): (() => void) => {
      const store = stores.get(config.storageKey);
      if (!store) return () => {};
      store.listeners.add(callback);
      return () => store.listeners.delete(callback);
    },
    [config.storageKey],
  );

  const getSnapshot = useCallback((): PanelState => {
    const store = stores.get(config.storageKey);
    return store?.state ?? { width: config.defaultWidth, isCollapsed: false };
  }, [config.storageKey, config.defaultWidth]);

  const getServerSnapshot = useCallback((): PanelState => {
    return { width: config.defaultWidth, isCollapsed: false };
  }, [config.defaultWidth]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [isDragging, setIsDragging] = useState(false);

  const setWidth = useCallback(
    (width: number) => {
      setStoreWidth(config.storageKey, config, width);
    },
    [config],
  );

  const setIsCollapsed = useCallback(
    (collapsed: boolean) => {
      setStoreCollapsed(config.storageKey, config, collapsed);
    },
    [config],
  );

  const toggleCollapsed = useCallback(() => {
    const currentState = getStoreState(config.storageKey);
    if (currentState) {
      setStoreCollapsed(config.storageKey, config, !currentState.isCollapsed);
    }
  }, [config]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const currentWidth = state.isCollapsed
    ? (config.collapsedWidth ?? config.minWidth)
    : state.width;

  return {
    width: currentWidth,
    storedWidth: state.width,
    isCollapsed: state.isCollapsed,
    isDragging,
    setWidth,
    setIsCollapsed,
    toggleCollapsed,
    startDrag,
    setIsDragging,
    config,
  };
}

export type UseResizablePanelReturn = ReturnType<typeof useResizablePanel>;
