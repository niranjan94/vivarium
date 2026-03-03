import { execFileSync, spawn } from 'node:child_process';
import { loadProjectName } from '../config.js';
import { readState } from '../registry.js';
import { log } from '../utils/logger.js';

/**
 * Spawn the MCP stdio-to-SSE proxy.
 * Reads state from the registry, computes the Docker network,
 * and runs a Docker container that bridges stdio to the given service's SSE endpoint.
 * The container is force-stopped and removed on process exit.
 */
export function mcpProxy(projectRoot: string, service: string) {
  const projectName = loadProjectName(projectRoot);
  const state = readState(projectName);

  if (!state) {
    log.error('No vivarium state found. Run `vivarium setup` first.');
    process.exit(1);
  }

  const network = `${state.composeName}_default`;
  const containerName = `vivarium-mcp-${projectName}-${service}`;

  const child = spawn(
    'docker',
    [
      'run',
      '--rm',
      '-i',
      '--name',
      containerName,
      '--label',
      `vivarium.project=${projectName}`,
      '--label',
      'vivarium.role=mcp-proxy',
      '--network',
      network,
      'ghcr.io/sparfenyuk/mcp-proxy:v0.11.0',
      `http://${service}:8000/sse`,
    ],
    { stdio: 'inherit' },
  );

  const cleanup = () => {
    try {
      execFileSync('docker', ['rm', '-f', containerName], { stdio: 'ignore' });
    } catch {
      // Container may already be removed
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
}
