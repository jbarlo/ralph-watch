import { z } from 'zod';

export const CommandConfigSchema = z.object({
  label: z.string().min(1),
  cmd: z.string().min(1),
  icon: z.string().optional(),
  destructive: z.boolean().optional(),
});

export type CommandConfig = z.infer<typeof CommandConfigSchema>;

export const TerminalButtonSchema = z.object({
  label: z.string().min(1),
  sequence: z.string().min(1),
  title: z.string().optional(),
});

export type TerminalButton = z.infer<typeof TerminalButtonSchema>;

export const ProjectConfigSchema = z.object({
  commands: z.array(CommandConfigSchema).optional(),
  terminalButtons: z.array(TerminalButtonSchema).optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

export const defaultCommands: CommandConfig[] = [
  { label: 'Run Next', cmd: 'ralph-once', icon: 'play' },
  { label: 'Run All', cmd: 'ralph', icon: 'zap' },
  { label: 'Stop', cmd: 'ralph-stop', icon: 'square', destructive: true },
];

export const defaultTerminalButtons: TerminalButton[] = [
  { label: '^C', sequence: '\x03', title: 'Send SIGINT (Ctrl+C)' },
  { label: 'Tab', sequence: '\t', title: 'Send Tab' },
  { label: 'S-Tab', sequence: '\x1b[Z', title: 'Send Shift+Tab (reverse tab)' },
  { label: 'Esc', sequence: '\x1b', title: 'Send Escape' },
  { label: '↑', sequence: '\x1b[A', title: 'Up arrow' },
  { label: '↓', sequence: '\x1b[B', title: 'Down arrow' },
];

export const defaultConfig: ProjectConfig = {
  commands: defaultCommands,
  terminalButtons: defaultTerminalButtons,
};
