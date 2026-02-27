import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, loadProjectName } from '../config.js';
import { findExistingClaim, projectDir, removeProject } from '../registry.js';
import { dockerCompose } from '../utils/docker.js';
import { log } from '../utils/logger.js';

/**
 * Full teardown flow:
 * 1. Load config + project name
 * 2. Stop and remove compose services + volumes
 * 3. Remove project from registry
 * 4. Migrate: clean up old .vivarium/ if it exists
 * 5. Remove generated package .env files
 */
export function teardown(projectRoot: string) {
  const config = loadConfig(projectRoot);
  const projectName = loadProjectName(projectRoot);

  log.info(`Tearing down ${projectName}`);

  const artifactDir = projectDir(projectName);
  const composePath = path.join(artifactDir, 'compose.yaml');
  const envPath = path.join(artifactDir, '.env');

  // Stop compose services
  if (fs.existsSync(composePath) && fs.existsSync(envPath)) {
    log.step('Stopping compose services');
    try {
      dockerCompose(composePath, envPath, ['down', '--remove-orphans', '--volumes'], {
        cwd: projectRoot,
      });
      log.success('Services stopped');
    } catch {
      log.warn('Failed to stop some services (they may already be stopped)');
    }
  } else {
    log.dim('No compose.yaml found in registry, skipping service shutdown');
  }

  // Remove project from registry
  const existing = findExistingClaim(projectName);
  if (existing) {
    removeProject(projectName);
    log.step(`Released index ${existing.index}`);
  }

  // Migration: clean up old .vivarium/ directory if it exists in the project root
  const legacyDir = path.join(projectRoot, '.vivarium');
  if (fs.existsSync(legacyDir)) {
    fs.rmSync(legacyDir, { recursive: true });
    log.step('Cleaned up legacy .vivarium/ directory');
  }

  // Remove generated package .env files
  for (const [_pkgName, pkgConfig] of Object.entries(config.packages)) {
    if (!pkgConfig.envFile) continue;
    const envFilePath = path.join(projectRoot, pkgConfig.envFile);
    if (fs.existsSync(envFilePath)) {
      fs.unlinkSync(envFilePath);
      log.step(`Removed ${pkgConfig.envFile}`);
    }
  }

  log.blank();
  log.success(`${projectName} teardown complete`);
}
