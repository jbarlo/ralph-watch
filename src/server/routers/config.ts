import fs from 'fs/promises';
import path from 'path';
import { router, publicProcedure } from '../trpc';
import {
  ProjectConfigSchema,
  defaultCommands,
  defaultTerminalButtons,
  type ProjectConfig,
} from '@/lib/project-config';
import { tryCatchAsync, isErr } from '@/lib/result';

const CONFIG_FILENAME = '.ralph-watch.json';

async function loadProjectConfig(ralphDir: string): Promise<ProjectConfig> {
  const configPath = path.join(ralphDir, CONFIG_FILENAME);

  const result = await tryCatchAsync(() =>
    fs.readFile(configPath, 'utf-8').then((content) => JSON.parse(content)),
  );

  if (isErr(result)) {
    return {
      commands: defaultCommands,
      terminalButtons: defaultTerminalButtons,
    };
  }

  const parsed = ProjectConfigSchema.safeParse(result.value);
  if (!parsed.success) {
    return {
      commands: defaultCommands,
      terminalButtons: defaultTerminalButtons,
    };
  }

  return {
    commands: parsed.data.commands ?? defaultCommands,
    terminalButtons: parsed.data.terminalButtons ?? defaultTerminalButtons,
  };
}

export const configRouter = router({
  getProjectPath: publicProcedure.query(({ ctx }) => {
    return ctx.ralphDir;
  }),

  get: publicProcedure.query(async ({ ctx }) => {
    return loadProjectConfig(ctx.ralphDir);
  }),
});
