import { execFileSync } from 'node:child_process';
import { log } from './logger.js';

/** Check that a CLI tool is available on PATH. */
function checkCommand(name: string): boolean {
  try {
    execFileSync('which', [name], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify that all required prerequisites (docker) are installed.
 * Exits the process if any are missing.
 */
export function checkPrerequisites() {
  const required = ['docker'];
  const missing = required.filter((cmd) => !checkCommand(cmd));

  if (missing.length > 0) {
    log.error(`Missing required tools: ${missing.join(', ')}`);
    log.dim('Install them and try again.');
    process.exit(1);
  }
}
