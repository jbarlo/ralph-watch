/**
 * Recent projects management using cookies
 * Stores project paths for the project picker on the home page
 */

const COOKIE_NAME = 'ralph-recent-projects';
const MAX_RECENT_PROJECTS = 10;

export interface RecentProject {
  path: string;
  name?: string;
  lastUsed: number;
}

/**
 * Parse the recent projects cookie
 */
function parseCookie(): RecentProject[] {
  if (typeof document === 'undefined') return [];

  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === COOKIE_NAME && value) {
      try {
        return JSON.parse(decodeURIComponent(value)) as RecentProject[];
      } catch {
        return [];
      }
    }
  }
  return [];
}

/**
 * Save recent projects to cookie
 */
function saveCookie(projects: RecentProject[]): void {
  if (typeof document === 'undefined') return;

  const value = encodeURIComponent(JSON.stringify(projects));
  // Cookie expires in 1 year
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  document.cookie = `${COOKIE_NAME}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/**
 * Get all recent projects sorted by last used (most recent first)
 */
export function getRecentProjects(): RecentProject[] {
  return parseCookie().sort((a, b) => b.lastUsed - a.lastUsed);
}

/**
 * Add a project to recent projects
 * Updates lastUsed if project already exists
 */
export function addRecentProject(path: string, name?: string): void {
  const projects = parseCookie();

  // Remove existing entry for this path
  const filtered = projects.filter((p) => p.path !== path);

  // Add new entry at the beginning
  filtered.unshift({
    path,
    name,
    lastUsed: Date.now(),
  });

  // Keep only the most recent projects
  saveCookie(filtered.slice(0, MAX_RECENT_PROJECTS));
}

/**
 * Remove a project from recent projects
 */
export function removeRecentProject(path: string): void {
  const projects = parseCookie();
  const filtered = projects.filter((p) => p.path !== path);
  saveCookie(filtered);
}

/**
 * Update project name in recent projects
 */
export function updateRecentProjectName(path: string, name: string): void {
  const projects = parseCookie();
  const project = projects.find((p) => p.path === path);
  if (project) {
    project.name = name;
    saveCookie(projects);
  }
}

/**
 * Derive project name from path (last directory component)
 */
export function deriveProjectName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
