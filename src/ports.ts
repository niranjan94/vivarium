import { execSync } from 'node:child_process';
import os from 'node:os';

/** Computed port assignments for a given index. */
export interface PortMap {
  postgres: number;
  redis: number;
  s3: number;
  s3Console: number;
  frontend: number;
  backend: number;
}

/** Compute all ports from a given index (0–99). */
export function computePorts(index: number): PortMap {
  return {
    postgres: 5433 + index,
    redis: 6380 + index,
    s3: 9010 + index * 10,
    s3Console: 9011 + index * 10,
    frontend: 4000 + index * 10,
    backend: 4001 + index * 10,
  };
}

/**
 * Check if a TCP port is in use (LISTEN state).
 * Uses platform-appropriate commands.
 */
export function isPortInUse(port: number): boolean {
  try {
    const platform = os.platform();
    if (platform === 'darwin') {
      const result = execSync(`lsof -iTCP:${port} -sTCP:LISTEN`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return result.trim().length > 0;
    }
    // Linux / WSL
    const result = execSync(`ss -tlnH sport = :${port}`, {
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}
