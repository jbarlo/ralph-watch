/**
 * Project management utilities for localStorage persistence
 */

const STORAGE_KEY = 'ralph-watch-projects';
const ACTIVE_PROJECT_KEY = 'ralph-watch-active-project';
const PROJECT_FILTERS_KEY = 'ralph-watch-project-filters';

/**
 * Project configuration stored in localStorage
 */
export interface Project {
  path: string;
  name?: string;
  addedAt: number;
}

/**
 * Projects data structure
 */
export interface ProjectsData {
  projects: Project[];
}

/**
 * Per-project filter state
 */
export interface ProjectFilters {
  [projectPath: string]: {
    status?: string;
  };
}

/**
 * Check if we're running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Get all saved projects from localStorage
 */
export function getProjects(): Project[] {
  if (!isBrowser()) return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const data = JSON.parse(stored) as ProjectsData;
    return data.projects ?? [];
  } catch {
    return [];
  }
}

/**
 * Save projects list to localStorage
 */
export function saveProjects(projects: Project[]): void {
  if (!isBrowser()) return;

  const data: ProjectsData = { projects };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Add a project to the list
 */
export function addProject(path: string, name?: string): Project {
  const projects = getProjects();

  // Check if already exists
  const existing = projects.find((p) => p.path === path);
  if (existing) {
    return existing;
  }

  const project: Project = {
    path,
    name,
    addedAt: Date.now(),
  };

  projects.push(project);
  saveProjects(projects);
  return project;
}

/**
 * Remove a project from the list
 */
export function removeProject(path: string): void {
  const projects = getProjects();
  const filtered = projects.filter((p) => p.path !== path);
  saveProjects(filtered);

  // Also clear filter state for this project
  const filters = getProjectFilters();
  delete filters[path];
  saveProjectFilters(filters);
}

/**
 * Get the active project path
 */
export function getActiveProject(): string | null {
  if (!isBrowser()) return null;

  try {
    return localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

/**
 * Set the active project path
 */
export function setActiveProject(path: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_PROJECT_KEY, path);
}

/**
 * Get all project filter states
 */
export function getProjectFilters(): ProjectFilters {
  if (!isBrowser()) return {};

  try {
    const stored = localStorage.getItem(PROJECT_FILTERS_KEY);
    if (!stored) return {};
    return JSON.parse(stored) as ProjectFilters;
  } catch {
    return {};
  }
}

/**
 * Save project filter states
 */
export function saveProjectFilters(filters: ProjectFilters): void {
  if (!isBrowser()) return;
  localStorage.setItem(PROJECT_FILTERS_KEY, JSON.stringify(filters));
}

/**
 * Get filter state for a specific project
 */
export function getProjectFilter(projectPath: string): { status?: string } {
  const filters = getProjectFilters();
  return filters[projectPath] ?? {};
}

/**
 * Set filter state for a specific project
 */
export function setProjectFilter(
  projectPath: string,
  filter: { status?: string },
): void {
  const filters = getProjectFilters();
  filters[projectPath] = filter;
  saveProjectFilters(filters);
}

/**
 * Derive project name from path (last directory component)
 */
export function deriveProjectName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
