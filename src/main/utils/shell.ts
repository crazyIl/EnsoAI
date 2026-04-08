/**
 * Shared shell utilities for consistent shell configuration across the app.
 * Reads user's shell config from settings and provides consistent environment.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ShellConfig } from '@shared/types';
import * as pty from 'node-pty';
import { readSettings } from '../ipc/settings';
import { findLoginShell, getEnhancedPath } from '../services/terminal/PtyManager';
import { shellDetector } from '../services/terminal/ShellDetector';
import { killProcessTree } from './processUtils';

const execFileAsync = promisify(execFile);

const SHELL_ENV_MARKER = '__ENSO_SHELL_ENV__';
const SHELL_ENV_KEYS = [
  'SSH_AUTH_SOCK',
  'SSH_AGENT_PID',
  'SSH_ASKPASS',
  'GIT_ASKPASS',
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'BW_SESSION',
];

let cachedShellEnv: Record<string, string> | null = null;
let shellEnvCacheTimestamp = 0;
let pendingShellEnvLoad: Promise<Record<string, string>> | null = null;
const SHELL_ENV_CACHE_TTL = 10000;

// Re-export for convenience
export { killProcessTree } from './processUtils';

/**
 * Strip ANSI escape codes from terminal output
 */
export function stripAnsi(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape sequence is intentional
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Get shell configuration for executing commands.
 * Uses user's configured shell from settings, falls back to findLoginShell.
 */
export function getShellForCommand(): { shell: string; args: string[] } {
  const settings = readSettings();
  // zustand stores settings under 'enso-settings.state'
  const zustandState = (settings?.['enso-settings'] as { state?: Record<string, unknown> })?.state;
  const shellConfig = zustandState?.shellConfig as ShellConfig | undefined;

  if (shellConfig) {
    const { shell, execArgs } = shellDetector.resolveShellForCommand(shellConfig);
    return { shell, args: execArgs };
  }

  return findLoginShell();
}

/**
 * Get environment variables for executing commands.
 * Includes enhanced PATH and proper locale settings.
 */
export function getEnvForCommand(additionalEnv?: Record<string, string>): Record<string, string> {
  return {
    ...process.env,
    PATH: getEnhancedPath(),
    LANG: process.env.LANG || 'en_US.UTF-8',
    LC_ALL: process.env.LC_ALL || process.env.LANG || 'en_US.UTF-8',
    ...additionalEnv,
  } as Record<string, string>;
}

function buildShellEnvCommand(): string {
  const keys = SHELL_ENV_KEYS.map((key) => `'${key}'`).join(' ');
  return [
    `printf '${SHELL_ENV_MARKER}\\n'`,
    `for key in ${keys}; do`,
    '  value=$(printenv "$key" 2>/dev/null || true)',
    '  printf "%s=%s\\n" "$key" "$value"',
    'done',
  ].join('; ');
}

function parseShellEnvOutput(output: string): Record<string, string> {
  const markerIndex = output.lastIndexOf(`${SHELL_ENV_MARKER}\n`);
  if (markerIndex === -1) {
    return {};
  }

  const envBlock = output.slice(markerIndex + SHELL_ENV_MARKER.length + 1);
  const envVars: Record<string, string> = {};

  for (const line of envBlock.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    if (key && value) {
      envVars[key] = value;
    }
  }

  return envVars;
}

async function loadShellEnvFromLoginShell(): Promise<Record<string, string>> {
  if (process.platform === 'win32') {
    return {};
  }

  const { shell, args } = getShellForCommand();
  const { stdout } = await execFileAsync(shell, [...args, buildShellEnvCommand()], {
    timeout: 8000,
    env: getEnvForCommand(),
    maxBuffer: 1024 * 1024,
  });

  return parseShellEnvOutput(stdout);
}

export async function getShellEnvForCommand(forceRefresh = false): Promise<Record<string, string>> {
  if (process.platform === 'win32') {
    return {};
  }

  if (
    !forceRefresh &&
    cachedShellEnv &&
    Date.now() - shellEnvCacheTimestamp < SHELL_ENV_CACHE_TTL
  ) {
    return cachedShellEnv;
  }

  if (!forceRefresh && pendingShellEnvLoad) {
    return pendingShellEnvLoad;
  }

  const loadPromise = loadShellEnvFromLoginShell()
    .then((envVars) => {
      cachedShellEnv = envVars;
      shellEnvCacheTimestamp = Date.now();
      pendingShellEnvLoad = null;
      return envVars;
    })
    .catch((error) => {
      pendingShellEnvLoad = null;
      throw error;
    });

  pendingShellEnvLoad = loadPromise;
  return loadPromise;
}

export async function getResolvedEnvForCommand(
  additionalEnv?: Record<string, string>,
  options?: { forceShellRefresh?: boolean }
): Promise<Record<string, string>> {
  let shellEnv: Record<string, string> = {};

  try {
    shellEnv = await getShellEnvForCommand(options?.forceShellRefresh ?? false);
  } catch {
    shellEnv = {};
  }

  return {
    ...getEnvForCommand(),
    ...shellEnv,
    ...additionalEnv,
  };
}

export interface ExecInPtyOptions {
  /** Timeout in milliseconds (default: 15000) */
  timeout?: number;
  /** If true, force kill after timeout and return collected output instead of rejecting */
  killOnTimeout?: boolean;
}

/**
 * Execute command in PTY to load user's environment (PATH, nvm, mise, volta, etc.)
 * Uses the same mechanism as terminal sessions to ensure consistent behavior.
 *
 * @param command - The command to execute
 * @param options - Execution options
 * @returns The command output (cleaned of ANSI codes)
 */
export async function execInPty(command: string, options: ExecInPtyOptions = {}): Promise<string> {
  const { timeout = 15000, killOnTimeout = false } = options;

  return new Promise((resolve, reject) => {
    const { shell, args } = getShellForCommand();
    const shellName = shell.toLowerCase();

    // Construct shell args with command
    // Shell will naturally exit with the command's exit code
    let shellArgs: string[];
    if (shellName.includes('wsl')) {
      // WSL: wsl.exe doesn't load user's shell environment by default.
      // We use 'exec "$SHELL"' to launch user's actual shell (bash/zsh) with login flag
      // to ensure PATH and other environment variables are properly initialized.
      const escapedCommand = command.replace(/"/g, '\\"');
      shellArgs = ['-e', 'sh', '-lc', `exec "$SHELL" -ilc "${escapedCommand}"`];
    } else {
      shellArgs = [...args, command];
    }

    let output = '';
    let hasExited = false;
    let ptyProcess: pty.IPty | null = null;

    const timeoutId = setTimeout(() => {
      if (!hasExited && ptyProcess) {
        hasExited = true;
        // Kill entire process tree to ensure child processes are also terminated
        killProcessTree(ptyProcess);
        const cleaned = stripAnsi(output).trim();
        if (killOnTimeout) {
          // When killOnTimeout is true, always resolve with collected output (even if empty)
          // Let the caller decide how to handle empty results
          resolve(cleaned);
        } else {
          reject(new Error('Detection timeout'));
        }
      }
    }, timeout);

    try {
      ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE || '/',
        env: {
          ...getEnvForCommand(),
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        } as Record<string, string>,
      });

      ptyProcess.onData((data) => {
        output += data;
      });

      ptyProcess.onExit(({ exitCode }) => {
        if (hasExited) return;
        hasExited = true;
        clearTimeout(timeoutId);

        const cleaned = stripAnsi(output).trim();
        if (exitCode === 0) {
          resolve(cleaned);
        } else {
          reject(new Error(`Command exited with code ${exitCode}`));
        }
      });
    } catch (error) {
      hasExited = true;
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}
