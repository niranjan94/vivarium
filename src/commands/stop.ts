import fs from 'node:fs';
import path from 'node:path';
import { loadProjectName } from '../config.js';
import { projectDir } from '../registry.js';
import { dockerCompose } from '../utils/docker.js';
import { log } from '../utils/logger.js';

/**
 * Stop compose services using the existing registry config.
 * Does not run any teardown logic — use `vivarium teardown` for full cleanup.
 */
export function stop(projectRoot: string) {
  const artifactDir = projectDir(loadProjectName(projectRoot));
  const composePath = path.join(artifactDir, 'compose.yaml');
  const envPath = path.join(artifactDir, '.env');

  if (!fs.existsSync(composePath)) {
    log.error('No compose.yaml found. Run `vivarium setup` first.');
    process.exit(1);
  }

  log.info('Stopping services');
  dockerCompose(composePath, envPath, ['down'], { cwd: projectRoot });
  log.success('Services stopped');
}
