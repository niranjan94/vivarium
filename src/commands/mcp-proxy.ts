import { execFileSync } from 'node:child_process';
import { loadProjectName } from '../config.js';
import { readState } from '../registry.js';
import { log } from '../utils/logger.js';

/**
 * Spawn the MCP stdio-to-SSE proxy.
 * Reads state from the registry, computes the Docker network,
 * and exec's into a docker run that bridges stdio to the postgres-mcp SSE endpoint.
 */
export function mcpProxy(projectRoot: string) {
  const projectName = loadProjectName(projectRoot);
  const state = readState(projectName);

  if (!state) {
    log.error('No vivarium state found. Run `vivarium setup` first.');
    process.exit(1);
  }

  const network = `${state.composeName}_default`;

  execFileSync(
    'docker',
    [
      'run',
      '--rm',
      '-i',
      '--network',
      network,
      'ghcr.io/sparfenyuk/mcp-proxy:v0.11.0',
      'http://postgres-mcp:8000/sse',
    ],
    { stdio: 'inherit' },
  );
}
