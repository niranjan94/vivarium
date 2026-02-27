import fs from 'node:fs';
import path from 'node:path';
import type { VivariumConfig } from '../config.js';
import { loadConfig, loadProjectName } from '../config.js';
import { findExistingClaim, projectDir, removeProject } from '../registry.js';
import { dockerCompose } from '../utils/docker.js';
import { log } from '../utils/logger.js';

/**
 * Full teardown flow:
 * 1. Load config (optional — teardown proceeds without it)
 * 2. Load project name
 * 3. Stop and remove compose services + volumes
 * 4. Remove project from registry
 * 5. Migrate: clean up old .vivarium/ if it exists
 * 6. Remove generated package .env files (requires config)
 */
export function teardown(projectRoot: string) {
  const config = tryLoadConfig(projectRoot);
  const projectName = loadProjectName(projectRoot);

  log.info(`Tearing down ${projectName}`);

  const artifactDir = projectDir(projectName);
  const composePath = path.join(artifactDir, 'compose.yaml');
  const envPath = path.join(artifactDir, '.env');

  // Stop compose services
  if (fs.existsSync(composePath) && fs.existsSync(envPath)) {
    log.step('Stopping compose services');
    try {
      dockerCompose(
        composePath,
        envPath,
        ['down', '--remove-orphans', '--volumes'],
        {
          cwd: projectRoot,
        },
      );
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
  if (config) {
    for (const [_pkgName, pkgConfig] of Object.entries(config.packages)) {
      if (!pkgConfig.envFile) continue;
      const envFilePath = path.join(projectRoot, pkgConfig.envFile);
      if (fs.existsSync(envFilePath)) {
        fs.unlinkSync(envFilePath);
        log.step(`Removed ${pkgConfig.envFile}`);
      }
    }
  } else {
    log.warn(
      'No config found — skipping package .env cleanup. Remove them manually if needed.',
    );
  }

  log.blank();
  log.success(`${projectName} teardown complete`);
}

/**
 * Attempt to load config, returning null if no config file exists.
 * Checks for config files before calling loadConfig to avoid process.exit.
 */
function tryLoadConfig(projectRoot: string): VivariumConfig | null {
  const vivariumJsonPath = path.join(projectRoot, 'vivarium.json');
  if (fs.existsSync(vivariumJsonPath)) return loadConfig(projectRoot);

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (pkg.vivarium) return loadConfig(projectRoot);
  }

  return null;
}
