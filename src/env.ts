import fs from 'node:fs';
import path from 'node:path';
import type { PackageConfig, ServiceConfig, VivariumConfig } from './config.js';
import type { PortMap } from './ports.js';
import { log } from './utils/logger.js';

/**
 * Generate the .env file used for docker compose variable interpolation.
 */
export function generateComposeEnv(
  config: VivariumConfig,
  ports: PortMap,
  composeName: string,
): string {
  const lines: string[] = [`COMPOSE_PROJECT_NAME=${composeName}`, ''];

  if (config.services.postgres) {
    lines.push(
      `POSTGRES_PORT=${ports.postgres}`,
      `POSTGRES_USER=${config.services.postgres.user}`,
      `POSTGRES_PASSWORD=${config.services.postgres.password}`,
      `POSTGRES_DB=${config.services.postgres.database}`,
      '',
    );
  }

  if (config.services.redis) {
    lines.push(`REDIS_PORT=${ports.redis}`, '');
  }

  if (config.services.s3) {
    lines.push(
      `S3_PORT=${ports.s3}`,
      `S3_CONSOLE_PORT=${ports.s3Console}`,
      `S3_ACCESS_KEY=${config.services.s3.accessKey}`,
      `S3_SECRET_KEY=${config.services.s3.secretKey}`,
      '',
    );
  }

  return lines.join('\n');
}

/**
 * Generate convention-based env vars for a known package ("backend" or "frontend"),
 * merged with any custom env entries from config.
 */
export function generatePackageEnv(
  packageName: string,
  packageConfig: PackageConfig,
  config: VivariumConfig,
  ports: PortMap,
  allPackageNames: string[],
): string {
  const vars: Record<string, string> = {};

  if (packageName === 'backend') {
    generateBackendEnv(vars, config.services, ports, allPackageNames);
  } else if (packageName === 'frontend') {
    generateFrontendEnv(vars, config.services, ports, allPackageNames);
  }

  // Custom env entries override convention defaults
  if (packageConfig.env) {
    Object.assign(vars, packageConfig.env);
  }

  return Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n')
    .concat('\n');
}

/** Generate convention env vars for a backend package. */
function generateBackendEnv(
  vars: Record<string, string>,
  services: ServiceConfig,
  ports: PortMap,
  allPackageNames: string[],
) {
  // Always set API listen port and URL
  vars.API_LISTEN_PORT = String(ports.backend);
  vars.API_URL = `http://localhost:${ports.backend}`;

  if (allPackageNames.includes('frontend')) {
    vars.FRONTEND_URL = `http://localhost:${ports.frontend}`;
  }

  if (services.postgres) {
    const { user, password, database } = services.postgres;
    vars.DATABASE_URL = `postgresql://${user}:${password}@localhost:${ports.postgres}/${database}`;
  }

  if (services.redis) {
    vars.REDIS_ENABLED = 'true';
    vars.REDIS_URL = `redis://localhost:${ports.redis}/0`;
    vars.REDIS_QUEUE_URL = `redis://localhost:${ports.redis}/1`;
  }

  if (services.s3) {
    vars.AWS_S3_REGION = 'us-east-1';
    vars.AWS_S3_ACCESS_KEY_ID = services.s3.accessKey;
    vars.AWS_S3_SECRET_ACCESS_KEY = services.s3.secretKey;
    vars.AWS_S3_ENDPOINT = `http://localhost:${ports.s3}`;
    const buckets = services.s3.buckets;
    if (buckets.length > 0) vars.AWS_S3_BUCKET_NAME = buckets[0];
    if (buckets.length > 1) vars.AWS_S3_TEMP_BUCKET_NAME = buckets[1];
  }
}

/** Generate convention env vars for a frontend package. */
function generateFrontendEnv(
  vars: Record<string, string>,
  services: ServiceConfig,
  ports: PortMap,
  allPackageNames: string[],
) {
  vars.PORT = String(ports.frontend);
  vars.NEXT_PUBLIC_FRONTEND_URL = `http://localhost:${ports.frontend}`;

  if (allPackageNames.includes('backend')) {
    vars.NEXT_PUBLIC_API_URL = `http://localhost:${ports.backend}`;
  }

  if (services.s3) {
    vars.NEXT_PUBLIC_ASSET_SRC = `https://localhost:${ports.s3}`;
  }
}

/**
 * Write package .env files to the project root based on config.
 */
export function writePackageEnvFiles(
  projectRoot: string,
  config: VivariumConfig,
  ports: PortMap,
) {
  const allPackageNames = Object.keys(config.packages);

  for (const [pkgName, pkgConfig] of Object.entries(config.packages)) {
    if (!pkgConfig.envFile) continue;

    const envContent = generatePackageEnv(
      pkgName,
      pkgConfig,
      config,
      ports,
      allPackageNames,
    );
    const envPath = path.join(projectRoot, pkgConfig.envFile);

    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    fs.writeFileSync(envPath, envContent);
    log.step(`Wrote ${pkgConfig.envFile}`);
  }
}
