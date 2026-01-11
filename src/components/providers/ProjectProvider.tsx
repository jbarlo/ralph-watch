'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  getActiveProject,
  setActiveProject as setActiveProjectInStorage,
  getProjects,
  addProject,
} from '@/lib/projects';

interface ProjectContextValue {
  /**
   * Currently active project path
   */
  activeProjectPath: string | null;
  /**
   * Set the active project
   */
  setActiveProject: (path: string) => void;
  /**
   * Default project path from server (RALPH_DIR env var)
   */
  defaultProjectPath: string | null;
  /**
   * Whether project state has been initialized from localStorage
   */
  isInitialized: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
  /**
   * Default project path from server (RALPH_DIR env var)
   */
  defaultProjectPath?: string;
}

/**
 * Initialize project state from localStorage
 * This runs once during initial render
 */
function initializeProjectState(defaultProjectPath?: string): {
  path: string | null;
  needsSetup: boolean;
} {
  if (typeof window === 'undefined') {
    // SSR: use default, mark as needing setup
    return { path: defaultProjectPath ?? null, needsSetup: true };
  }

  const stored = getActiveProject();
  if (stored) {
    return { path: stored, needsSetup: false };
  }

  if (defaultProjectPath) {
    // Initialize with default
    addProject(defaultProjectPath);
    setActiveProjectInStorage(defaultProjectPath);
    return { path: defaultProjectPath, needsSetup: false };
  }

  return { path: null, needsSetup: false };
}

/**
 * Provider for project context
 * Manages active project selection and persistence
 */
export function ProjectProvider({
  children,
  defaultProjectPath,
}: ProjectProviderProps) {
  // Initialize state lazily to avoid effect-based setState
  const [state] = useState(() => initializeProjectState(defaultProjectPath));
  const [activeProjectPath, setActiveProjectPathState] = useState<
    string | null
  >(state.path);
  const [isInitialized] = useState(!state.needsSetup);

  const setActiveProject = useCallback((path: string) => {
    setActiveProjectPathState(path);
    setActiveProjectInStorage(path);
    // Ensure project is in the list
    const projects = getProjects();
    if (!projects.find((p) => p.path === path)) {
      addProject(path);
    }
  }, []);

  return (
    <ProjectContext.Provider
      value={{
        activeProjectPath,
        setActiveProject,
        defaultProjectPath: defaultProjectPath ?? null,
        isInitialized,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

/**
 * Hook to access project context
 */
export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}

/**
 * Get ralphDir header value for tRPC client
 * Returns the active project path to pass to server
 */
export function useRalphDir(): string | undefined {
  const context = useContext(ProjectContext);
  return context?.activeProjectPath ?? context?.defaultProjectPath ?? undefined;
}
