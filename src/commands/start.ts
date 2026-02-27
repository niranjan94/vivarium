import fs from 'node:fs';
import path from 'node:path';
import { loadProjectName } from '../config.js';
import { projectDir } from '../registry.js';
import { dockerCompose } from '../utils/docker.js';
import { log } from '../utils/logger.js';

/**
 * Start compose services using the existing registry config.
 * Does not run any setup logic — use `vivarium setup` first.
 */
export function start(projectRoot: string) {
  const artifactDir = projectDir(loadProjectName(projectRoot));
  const composePath = path.join(artifactDir, 'compose.yaml');
  const envPath = path.join(artifactDir, '.env');

  if (!fs.existsSync(composePath)) {
    log.error('No compose.yaml found. Run `vivarium setup` first.');
    process.exit(1);
  }

  log.info('Starting services');
  dockerCompose(composePath, envPath, ['up', '-d', '--wait'], {
    cwd: projectRoot,
  });
  log.success('Services running');
}
