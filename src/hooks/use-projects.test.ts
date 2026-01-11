import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProjects } from './use-projects';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('useProjects', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('should render without throwing errors', () => {
    // This test specifically checks for the infinite loop bug
    // If the hook causes an infinite loop, renderHook will throw/timeout
    expect(() => {
      const { result } = renderHook(() => useProjects());
      expect(result.current).toBeDefined();
    }).not.toThrow();
  });

  it('should return stable references on multiple renders', () => {
    const { result, rerender } = renderHook(() => useProjects());

    const firstProjects = result.current.projects;
    const firstAddProject = result.current.addProject;
    const firstRemoveProject = result.current.removeProject;
    const firstSetActiveProject = result.current.setActiveProject;

    // Trigger re-render
    rerender();

    // Projects array should be the same reference (not causing infinite loop)
    expect(result.current.projects).toBe(firstProjects);
    // Callbacks should be stable due to useCallback
    expect(result.current.addProject).toBe(firstAddProject);
    expect(result.current.removeProject).toBe(firstRemoveProject);
    expect(result.current.setActiveProject).toBe(firstSetActiveProject);
  });

  it('should start with empty projects array', () => {
    const { result } = renderHook(() => useProjects());
    expect(result.current.projects).toEqual([]);
    expect(result.current.activeProject).toBeNull();
    expect(result.current.activeProjectPath).toBeNull();
  });

  it('should add a project successfully', () => {
    const { result } = renderHook(() => useProjects());

    act(() => {
      result.current.addProject('/test/path', 'Test Project');
    });

    expect(result.current.projects.length).toBe(1);
    expect(result.current.projects[0]?.path).toBe('/test/path');
    expect(result.current.projects[0]?.name).toBe('Test Project');
  });

  it('should remove a project successfully', () => {
    const { result } = renderHook(() => useProjects());

    act(() => {
      result.current.addProject('/test/path1', 'Project 1');
      result.current.addProject('/test/path2', 'Project 2');
    });

    expect(result.current.projects.length).toBe(2);

    act(() => {
      result.current.removeProject('/test/path1');
    });

    expect(result.current.projects.length).toBe(1);
    expect(result.current.projects[0]?.path).toBe('/test/path2');
  });

  it('should set active project correctly', () => {
    const { result } = renderHook(() => useProjects());

    act(() => {
      result.current.addProject('/test/path', 'Test Project');
      result.current.setActiveProject('/test/path');
    });

    expect(result.current.activeProjectPath).toBe('/test/path');
    expect(result.current.activeProject).not.toBeNull();
    expect(result.current.activeProject?.path).toBe('/test/path');
  });

  it('should maintain stable references after mutations', () => {
    const { result, rerender } = renderHook(() => useProjects());

    act(() => {
      result.current.addProject('/test/path', 'Test Project');
    });

    const projectsAfterAdd = result.current.projects;

    // Trigger re-render without mutation
    rerender();

    // Projects reference should be stable (same cached array)
    expect(result.current.projects).toBe(projectsAfterAdd);
  });

  it('should handle multiple hook instances without issues', () => {
    // Render multiple instances of the hook simultaneously
    // If there's an infinite loop bug, this would cause issues
    const { result: result1 } = renderHook(() => useProjects());
    const { result: result2 } = renderHook(() => useProjects());

    expect(result1.current.projects).toBeDefined();
    expect(result2.current.projects).toBeDefined();

    // Both should share the same cache
    act(() => {
      result1.current.addProject('/shared/path', 'Shared');
    });

    // result2 should also see the new project after re-render
    expect(result2.current.projects.length).toBe(1);
  });
});
