'use client';

import { useState } from 'react';
import { useProjects } from '@/hooks/use-projects';
import { deriveProjectName } from '@/lib/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface ProjectSwitcherProps {
  /**
   * Default project path from server environment (RALPH_DIR)
   */
  defaultProjectPath?: string;
  /**
   * Callback when active project changes
   */
  onProjectChange?: (path: string) => void;
}

/**
 * Dropdown component for switching between multiple projects
 */
export function ProjectSwitcher({
  defaultProjectPath,
  onProjectChange,
}: ProjectSwitcherProps) {
  const {
    projects,
    activeProjectPath,
    addProject,
    removeProject,
    setActiveProject,
  } = useProjects();

  const [open, setOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPath, setNewPath] = useState('');

  // Determine current project - use active from localStorage, or default from server
  const currentPath = activeProjectPath ?? defaultProjectPath;
  const currentName = currentPath
    ? (projects.find((p) => p.path === currentPath)?.name ??
      deriveProjectName(currentPath))
    : 'No project';

  const handleSelectProject = (path: string) => {
    setActiveProject(path);
    onProjectChange?.(path);
    setOpen(false);
  };

  const handleAddProject = () => {
    if (!newPath.trim()) return;

    const trimmedPath = newPath.trim();
    addProject(trimmedPath);
    setActiveProject(trimmedPath);
    onProjectChange?.(trimmedPath);
    setNewPath('');
    setShowAddForm(false);
    setOpen(false);
  };

  const handleRemoveProject = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    removeProject(path);
  };

  const handleUseDefault = () => {
    if (defaultProjectPath) {
      // Add to projects list if not already there
      addProject(defaultProjectPath);
      setActiveProject(defaultProjectPath);
      onProjectChange?.(defaultProjectPath);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="max-w-[200px] justify-between truncate"
        >
          <span className="truncate">{currentName}</span>
          <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandList>
            <ScrollArea className="max-h-[300px]">
              {projects.length > 0 && (
                <CommandGroup heading="Projects">
                  {projects.map((project) => (
                    <CommandItem
                      key={project.path}
                      value={project.path}
                      onSelect={() => handleSelectProject(project.path)}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <CheckIcon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            currentPath === project.path
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                        <div className="truncate">
                          <div className="truncate font-medium">
                            {project.name ?? deriveProjectName(project.path)}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {project.path}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => handleRemoveProject(e, project.path)}
                      >
                        <XIcon className="h-3 w-3" />
                      </Button>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {projects.length === 0 && !defaultProjectPath && (
                <CommandEmpty>No projects added yet.</CommandEmpty>
              )}

              {defaultProjectPath && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Server Default">
                    <CommandItem onSelect={handleUseDefault}>
                      <div className="flex items-center gap-2 truncate">
                        <CheckIcon
                          className={cn(
                            'h-4 w-4 shrink-0',
                            currentPath === defaultProjectPath &&
                              !projects.find(
                                (p) => p.path === defaultProjectPath,
                              )
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                        <div className="truncate">
                          <div className="truncate text-xs text-muted-foreground">
                            {defaultProjectPath}
                          </div>
                        </div>
                      </div>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}

              <CommandSeparator />

              <CommandGroup>
                {showAddForm ? (
                  <div className="flex flex-col gap-2 p-2">
                    <Input
                      placeholder="/path/to/project"
                      value={newPath}
                      onChange={(e) => setNewPath(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddProject();
                        } else if (e.key === 'Escape') {
                          setShowAddForm(false);
                          setNewPath('');
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAddProject}>
                        Add
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowAddForm(false);
                          setNewPath('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <CommandItem
                    onSelect={() => setShowAddForm(true)}
                    className="text-muted-foreground"
                  >
                    <PlusIcon className="mr-2 h-4 w-4" />
                    Add project...
                  </CommandItem>
                )}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
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
