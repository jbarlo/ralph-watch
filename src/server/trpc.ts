import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { resolve } from 'path';

/**
 * Get the Ralph directory from RALPH_DIR env var or use cwd
 */
export function getRalphDir(): string {
  return process.env.RALPH_DIR || process.cwd();
}

/**
 * Get the absolute path to a file in the Ralph directory
 */
export function getRalphFilePath(filename: string): string {
  return resolve(getRalphDir(), filename);
}

/**
 * Context available to all tRPC procedures
 */
export interface Context {
  ralphDir: string;
}

/**
 * Create context for each tRPC request
 */
export function createContext(): Context {
  return {
    ralphDir: getRalphDir(),
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
