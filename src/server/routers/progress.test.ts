import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { progressRouter } from './progress';
import type { Context } from '../trpc';

const TEST_DIR = join(process.cwd(), '.test-progress');
const PROGRESS_FILE = join(TEST_DIR, 'progress.txt');

/**
 * Create a test caller with context pointing to test directory
 */
function createTestCaller() {
  const ctx: Context = {
    ralphDir: TEST_DIR,
  };
  return progressRouter.createCaller(ctx);
}

describe('progress router', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('read', () => {
    it('returns empty string when file does not exist', async () => {
      const caller = createTestCaller();
      const content = await caller.read();
      expect(content).toBe('');
    });

    it('returns file content when file exists', async () => {
      const testContent = '# Progress Log\n\n## Ticket #1\n- Done something\n';
      await writeFile(PROGRESS_FILE, testContent);

      const caller = createTestCaller();
      const content = await caller.read();
      expect(content).toBe(testContent);
    });

    it('returns empty file content', async () => {
      await writeFile(PROGRESS_FILE, '');

      const caller = createTestCaller();
      const content = await caller.read();
      expect(content).toBe('');
    });

    it('handles multiline content', async () => {
      const multilineContent = `# Ralph Progress Log

## Ticket #1: Init project
- Created project structure
- Installed dependencies
- Files added: package.json, tsconfig.json

## Ticket #2: Add tests
- Added vitest
- Created test files
`;
      await writeFile(PROGRESS_FILE, multilineContent);

      const caller = createTestCaller();
      const content = await caller.read();
      expect(content).toBe(multilineContent);
    });
  });
});
