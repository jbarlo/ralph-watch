import { z } from 'zod';

export const CommandConfigSchema = z.object({
  label: z.string().min(1),
  cmd: z.string().min(1),
  icon: z.string().optional(),
  destructive: z.boolean().optional(),
});

export type CommandConfig = z.infer<typeof CommandConfigSchema>;

export const ProjectConfigSchema = z.object({
  commands: z.array(CommandConfigSchema),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export const defaultCommands: CommandConfig[] = [
  { label: 'Run Next', cmd: 'ralph-once', icon: 'play' },
  { label: 'Run All', cmd: 'ralph', icon: 'zap' },
  { label: 'Stop', cmd: 'ralph-stop', icon: 'square', destructive: true },
];

export const defaultConfig: ProjectConfig = {
  commands: defaultCommands,
};
