import fs from 'node:fs';
import path from 'node:path';
import { log } from './utils/logger.js';

/** Configuration for a single service. */
export interface PostgresServiceConfig {
  user: string;
  password: string;
  database: string;
}

export interface S3ServiceConfig {
  accessKey: string;
  secretKey: string;
  buckets: string[];
}

export type ServiceConfig = {
  postgres?: PostgresServiceConfig;
  redis?: boolean;
  s3?: S3ServiceConfig;
};

export interface PackageConfig {
  envFile?: string;
  env?: Record<string, string>;
  postSetup?: string[];
  framework?: 'nextjs' | 'vite';
  directory?: string;
}

export interface VivariumConfig {
  services: ServiceConfig;
  packages: Record<string, PackageConfig>;
}

/**
 * Load vivarium configuration with cascading lookup:
 * 1. vivarium.json in project root
 * 2. "vivarium" key in package.json
 */
export function loadConfig(projectRoot: string): VivariumConfig {
  const vivariumJsonPath = path.join(projectRoot, 'vivarium.json');
  if (fs.existsSync(vivariumJsonPath)) {
    log.dim('Loading config from vivarium.json');
    const raw = JSON.parse(fs.readFileSync(vivariumJsonPath, 'utf-8'));
    return validateConfig(raw);
  }

  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (pkg.vivarium) {
      log.dim('Loading config from package.json "vivarium" key');
      return validateConfig(pkg.vivarium);
    }
  }

  log.error(
    'No vivarium config found. Create vivarium.json or add "vivarium" to package.json.',
  );
  process.exit(1);
}

/** Read the project name from the root package.json, falling back to directory name. */
export function loadProjectName(projectRoot: string): string {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return path.basename(projectRoot);
  }
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return pkg.name ?? path.basename(projectRoot);
}

/** Basic validation — just ensures required fields exist. */
function validateConfig(raw: unknown): VivariumConfig {
  const config = raw as Record<string, unknown>;
  if (!config.services || typeof config.services !== 'object') {
    log.error('Config must have a "services" object.');
    process.exit(1);
  }
  if (!config.packages || typeof config.packages !== 'object') {
    log.error('Config must have a "packages" object.');
    process.exit(1);
  }
  return raw as VivariumConfig;
}
