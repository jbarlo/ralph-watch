'use client';

import { useState, useCallback, useSyncExternalStore } from 'react';
import {
  type Project,
  getProjects,
  addProject as addProjectToStorage,
  removeProject as removeProjectFromStorage,
  getActiveProject,
  setActiveProject as setActiveProjectInStorage,
  getProjectFilter,
  setProjectFilter,
  deriveProjectName,
} from '@/lib/projects';

/**
 * Subscribe to localStorage changes for projects
 */
const subscribers = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function notifySubscribers(): void {
  for (const callback of subscribers) {
    callback();
  }
}

/**
 * Get snapshot for SSR-safe localStorage reading
 */
function getProjectsSnapshot(): Project[] {
  if (typeof window === 'undefined') return [];
  return getProjects();
}

function getServerSnapshot(): Project[] {
  return [];
}

/**
 * Active project snapshot
 */
let activeProjectCache: string | null = null;
let activeProjectInitialized = false;

function getActiveProjectSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  if (!activeProjectInitialized) {
    activeProjectCache = getActiveProject();
    activeProjectInitialized = true;
  }
  return activeProjectCache;
}

function getServerActiveSnapshot(): string | null {
  return null;
}

/**
 * Hook for managing multiple projects
 *
 * Provides:
 * - List of saved projects
 * - Add/remove projects
 * - Active project selection
 * - Per-project filter state persistence
 */
export function useProjects() {
  const projects = useSyncExternalStore(
    subscribe,
    getProjectsSnapshot,
    getServerSnapshot,
  );

  const activeProjectPath = useSyncExternalStore(
    subscribe,
    getActiveProjectSnapshot,
    getServerActiveSnapshot,
  );

  // Local state for filter (per active project)
  // Initialize from localStorage if we have an active project
  const [filter, setFilterState] = useState<{ status?: string }>(() => {
    if (typeof window === 'undefined') return {};
    const path = getActiveProject();
    return path ? getProjectFilter(path) : {};
  });

  /**
   * Add a new project
   */
  const addProject = useCallback((path: string, name?: string): Project => {
    const project = addProjectToStorage(path, name ?? deriveProjectName(path));
    // Refresh cache and notify
    activeProjectCache = getActiveProject();
    notifySubscribers();
    return project;
  }, []);

  /**
   * Remove a project
   */
  const removeProject = useCallback((path: string): void => {
    removeProjectFromStorage(path);
    // If removing active project, clear it
    if (activeProjectCache === path) {
      const remaining = getProjects();
      if (remaining.length > 0 && remaining[0]) {
        setActiveProjectInStorage(remaining[0].path);
        activeProjectCache = remaining[0].path;
      } else {
        activeProjectCache = null;
      }
    }
    notifySubscribers();
  }, []);

  /**
   * Set the active project
   */
  const setActiveProject = useCallback((path: string): void => {
    setActiveProjectInStorage(path);
    activeProjectCache = path;
    notifySubscribers();
  }, []);

  /**
   * Set filter for current project and persist
   */
  const setFilter = useCallback(
    (newFilter: { status?: string }): void => {
      if (activeProjectPath) {
        setProjectFilter(activeProjectPath, newFilter);
      }
      setFilterState(newFilter);
    },
    [activeProjectPath],
  );

  /**
   * Get currently active project object
   */
  const activeProject = activeProjectPath
    ? (projects.find((p) => p.path === activeProjectPath) ?? null)
    : null;

  return {
    projects,
    activeProject,
    activeProjectPath,
    filter,
    addProject,
    removeProject,
    setActiveProject,
    setFilter,
  };
}
