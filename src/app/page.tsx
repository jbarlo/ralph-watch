'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  getRecentProjects,
  addRecentProject,
  removeRecentProject,
  deriveProjectName,
  type RecentProject,
} from '@/lib/recent-projects';
import { buildProjectUrl } from '@/lib/project-path';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Icon components
 */
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/**
 * Project card component
 */
interface ProjectCardProps {
  project: RecentProject;
  onSelect: () => void;
  onRemove: () => void;
}

function ProjectCard({ project, onSelect, onRemove }: ProjectCardProps) {
  const name = project.name ?? deriveProjectName(project.path);

  return (
    <Card
      className="group cursor-pointer transition-colors hover:bg-muted/50"
      onClick={onSelect}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <FolderIcon className="h-8 w-8 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium">{name}</h3>
          <p className="truncate text-sm text-muted-foreground">
            {project.path}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove from recent projects"
        >
          <TrashIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Add project form
 */
interface AddProjectFormProps {
  onAdd: (path: string) => void;
  onCancel: () => void;
}

function AddProjectForm({ onAdd, onCancel }: AddProjectFormProps) {
  const [path, setPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (path.trim()) {
      onAdd(path.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="text"
        placeholder="/path/to/project"
        value={path}
        onChange={(e) => setPath(e.target.value)}
        autoFocus
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={!path.trim()}>
          Open Project
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// For useSyncExternalStore to detect client-side hydration
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Home page - Project picker
 */
export default function HomePage() {
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);

  // Detect client-side rendering without triggering effect-based setState
  const isClient = useSyncExternalStore(
    emptySubscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  // Load recent projects only on client
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(() =>
    typeof window !== 'undefined' ? getRecentProjects() : [],
  );

  const handleSelectProject = (path: string) => {
    addRecentProject(path);
    router.push(buildProjectUrl(path));
  };

  const handleAddProject = (path: string) => {
    addRecentProject(path);
    setShowAddForm(false);
    router.push(buildProjectUrl(path));
  };

  const handleRemoveProject = (path: string) => {
    removeRecentProject(path);
    setRecentProjects(getRecentProjects());
  };

  // Server render placeholder
  if (!isClient) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b">
          <div className="flex h-14 items-center px-4 lg:px-6">
            <h1 className="text-lg font-semibold">Ralph Watch</h1>
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="flex h-14 items-center px-4 lg:px-6">
          <h1 className="text-lg font-semibold">Ralph Watch</h1>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center p-8">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold">Select a Project</h2>
            <p className="mt-2 text-muted-foreground">
              Choose a recent project or add a new one to get started
            </p>
          </div>

          {showAddForm ? (
            <Card>
              <CardHeader>
                <CardTitle>Add Project</CardTitle>
              </CardHeader>
              <CardContent>
                <AddProjectForm
                  onAdd={handleAddProject}
                  onCancel={() => setShowAddForm(false)}
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {recentProjects.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Recent Projects
                  </h3>
                  {recentProjects.map((project) => (
                    <ProjectCard
                      key={project.path}
                      project={project}
                      onSelect={() => handleSelectProject(project.path)}
                      onRemove={() => handleRemoveProject(project.path)}
                    />
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowAddForm(true)}
              >
                <PlusIcon className="mr-2 h-4 w-4" />
                Add Project
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
