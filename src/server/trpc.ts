import { initTRPC } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';
import { resolve } from 'path';
import { getEnv } from '@/lib/env';

// Validate environment variables on server startup (skip in test environment)
if (process.env.NODE_ENV !== 'test') {
  getEnv();
}

/**
 * Get the Ralph directory from RALPH_DIR env var or use cwd
 */
export function getRalphDir(): string {
  return process.env.RALPH_DIR || process.cwd();
}

/**
 * Get the absolute path to a file in a Ralph directory
 */
export function getRalphFilePath(filename: string, ralphDir?: string): string {
  return resolve(ralphDir ?? getRalphDir(), filename);
}

/**
 * Context available to all tRPC procedures
 */
export interface Context {
  ralphDir: string;
}

/**
 * Create context for each tRPC request
 * Reads x-ralph-dir header if present, otherwise uses env var
 */
export function createContext(opts: FetchCreateContextFnOptions): Context {
  const headerDir = opts.req.headers.get('x-ralph-dir');
  const ralphDir = headerDir ?? getRalphDir();

  return {
    ralphDir,
  };
}

/**
 * Initialize tRPC with superjson transformer
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

/**
 * Export reusable router and procedure helpers
 */
export const router = t.router;
export const publicProcedure = t.procedure;
