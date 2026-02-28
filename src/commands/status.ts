import fs from 'node:fs';
import path from 'node:path';
import { loadProjectName } from '../config.js';
import { projectDir, readState } from '../registry.js';
import { dockerCompose } from '../utils/docker.js';
import { log } from '../utils/logger.js';

/**
 * Show the current state of a vivarium-managed project:
 * claimed index, assigned ports, and container status.
 */
export function status(projectRoot: string) {
  const projectName = loadProjectName(projectRoot);
  const state = readState(projectName);

  if (!state) {
    log.info(`${projectName}: not set up`);
    log.dim('Run `vivarium setup` to get started.');
    return;
  }

  log.info(`${projectName} (index ${state.index})`);
  log.blank();

  // Print port assignments
  log.info('Ports:');
  for (const [name, port] of Object.entries(state.ports)) {
    log.step(`${name}: localhost:${port}`);
  }

  // Show container status via docker compose ps
  const artifactDir = projectDir(projectName);
  const composePath = path.join(artifactDir, 'compose.yaml');
  const envPath = path.join(artifactDir, '.env');

  if (fs.existsSync(composePath) && fs.existsSync(envPath)) {
    log.blank();
    log.info('Containers:');
    try {
      dockerCompose(composePath, envPath, ['ps', '--format', 'table']);
    } catch {
      log.warn('Could not retrieve container status');
    }
  }
}
