export function runCli(
  cliPath: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> },
): { stdout: string; stderr: string; exitCode: number }

export function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string>; shell?: boolean },
): { stdout: string; stderr: string; exitCode: number }
