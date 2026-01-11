import { z } from 'zod';

/**
 * Schema for required environment variables
 */
const EnvSchema = z.object({
  /**
   * Path to the directory containing ralph binaries (ralph, ralph-once)
   */
  RALPH_BIN: z.string().min(1),

  /**
   * Directory to watch for ralph files (defaults to cwd)
   */
  RALPH_DIR: z.string().optional(),

  /**
   * React editor integration (optional)
   */
  REACT_EDITOR: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Custom error messages for missing env vars
 */
const errorMessages: Record<string, string> = {
  RALPH_BIN:
    'Missing RALPH_BIN - set path to ralph bin directory (e.g., /usr/local/bin)',
};

/**
 * Parse and validate environment variables.
 * Throws with helpful error messages if required vars are missing.
 */
export function parseEnv(
  env: Record<string, string | undefined> = process.env,
): Env {
  const result = EnvSchema.safeParse(env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        const customMessage = errorMessages[path];
        return customMessage
          ? `  - ${customMessage}`
          : `  - ${path}: ${issue.message}`;
      })
      .join('\n');

    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * Validated environment variables.
 * Accessing this on the server will validate env vars immediately.
 * Only call this in server-side code (not in browser).
 */
let _env: Env | undefined;

export function getEnv(): Env {
  if (!_env) {
    _env = parseEnv();
  }
  return _env;
}

/**
 * Reset cached env (for testing)
 */
export function resetEnvCache(): void {
  _env = undefined;
}
