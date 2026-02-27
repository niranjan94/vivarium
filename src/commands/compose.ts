import fs from 'node:fs';
import path from 'node:path';
import { loadProjectName } from '../config.js';
import { projectDir } from '../registry.js';
import { dockerCompose } from '../utils/docker.js';
import { log } from '../utils/logger.js';

/**
 * Pass-through to docker compose using the generated registry config.
 * Forwards all extra arguments directly to docker compose.
 */
export function compose(projectRoot: string, args: string[]) {
  const artifactDir = projectDir(loadProjectName(projectRoot));
  const composePath = path.join(artifactDir, 'compose.yaml');
  const envPath = path.join(artifactDir, '.env');

  if (!fs.existsSync(composePath)) {
    log.error('No compose.yaml found. Run `vivarium setup` first.');
    process.exit(1);
  }

  dockerCompose(composePath, envPath, args, { cwd: projectRoot });
}
