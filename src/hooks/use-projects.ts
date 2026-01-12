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

const EMPTY_PROJECTS: Project[] = [];

/**
 * Projects cache with stable references.
 * useSyncExternalStore requires stable references - JSON.parse creates new arrays each call
 */
let projectsCache: Project[] = EMPTY_PROJECTS;
let projectsCacheInitialized = false;

/**
 * Refresh the projects cache from localStorage and notify subscribers
 */
function refreshCache(): void {
  projectsCache = getProjects();
  projectsCacheInitialized = true;
  notifySubscribers();
}

/**
 * Get snapshot for SSR-safe localStorage reading
 * Returns cached value to ensure stable references
 */
function getProjectsSnapshot(): Project[] {
  if (typeof window === 'undefined') return EMPTY_PROJECTS;
  if (!projectsCacheInitialized) {
    projectsCache = getProjects();
    projectsCacheInitialized = true;
  }
  return projectsCache;
}

function getServerSnapshot(): Project[] {
  return EMPTY_PROJECTS;
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

  const [filter, setFilterState] = useState<{ status?: string }>(() => {
    if (typeof window === 'undefined') return {};
    const path = getActiveProject();
    return path ? getProjectFilter(path) : {};
  });

  const addProject = useCallback((path: string, name?: string): Project => {
    const project = addProjectToStorage(path, name ?? deriveProjectName(path));
    activeProjectCache = getActiveProject();
    refreshCache();
    return project;
  }, []);

  const removeProject = useCallback((path: string): void => {
    removeProjectFromStorage(path);
    if (activeProjectCache === path) {
      const remaining = getProjects();
      if (remaining.length > 0 && remaining[0]) {
        setActiveProjectInStorage(remaining[0].path);
        activeProjectCache = remaining[0].path;
      } else {
        activeProjectCache = null;
      }
    }
    refreshCache();
  }, []);

  const setActiveProject = useCallback((path: string): void => {
    setActiveProjectInStorage(path);
    activeProjectCache = path;
    refreshCache();
  }, []);

  const setFilter = useCallback(
    (newFilter: { status?: string }): void => {
      if (activeProjectPath) {
        setProjectFilter(activeProjectPath, newFilter);
      }
      setFilterState(newFilter);
    },
    [activeProjectPath],
  );

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
