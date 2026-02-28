import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { generateCompose } from '../compose.js';
import { loadConfig, loadProjectName, type PackageConfig } from '../config.js';
import { generateComposeEnv, writePackageEnvFiles } from '../env.js';
import { computePorts } from '../ports.js';
import type { VivariumState } from '../registry.js';
import { autoAssignIndex, projectDir, writeState } from '../registry.js';
import { createS3Bucket, dockerCompose } from '../utils/docker.js';
import { log } from '../utils/logger.js';
import { checkPrerequisites } from '../utils/prerequisites.js';

/**
 * Full setup flow:
 * 1. Check prerequisites
 * 2. Load config + project name
 * 3. Claim index
 * 4. Compute ports
 * 5. Generate compose + env files (to registry dir)
 * 6. Start services
 * 7. Create S3 buckets
 * 8. Generate package env files
 * 9. Write state
 * 10. Run postSetup scripts
 * 11. Update .claude/launch.json
 * 12. Print summary
 */
export function setup(projectRoot: string) {
  checkPrerequisites();

  const config = loadConfig(projectRoot);
  const projectName = loadProjectName(projectRoot);
  const composeName = `${projectName}-local`;

  log.info(`Setting up ${projectName}`);

  // Claim index
  const index = autoAssignIndex(projectName);
  const ports = computePorts(index);

  // Ensure registry project directory exists
  const artifactDir = projectDir(projectName);
  fs.mkdirSync(artifactDir, { recursive: true });

  // Generate compose.yaml
  const composeContent = generateCompose(config.services, ports, composeName);
  const composePath = path.join(artifactDir, 'compose.yaml');
  fs.writeFileSync(composePath, composeContent);
  log.step('Generated compose.yaml');

  // Generate .env for compose interpolation
  const composeEnv = generateComposeEnv(config, ports, composeName);
  const envPath = path.join(artifactDir, '.env');
  fs.writeFileSync(envPath, composeEnv);
  log.step('Generated .env');

  // Pull and start services
  log.info('Starting services');
  dockerCompose(composePath, envPath, ['pull'], { cwd: projectRoot });
  dockerCompose(composePath, envPath, ['up', '-d', '--wait'], {
    cwd: projectRoot,
  });
  log.success('Services running');

  // Create S3 buckets if configured
  if (config.services.s3) {
    log.info('Creating S3 buckets');
    const endpoint = `http://localhost:${ports.s3}`;
    for (const bucket of config.services.s3.buckets) {
      createS3Bucket(
        endpoint,
        bucket,
        config.services.s3.accessKey,
        config.services.s3.secretKey,
      );
    }
  }

  // Generate package .env files
  log.info('Generating package .env files');
  writePackageEnvFiles(projectRoot, config, ports);

  // Write state file
  const state: VivariumState = {
    index,
    projectName,
    composeName,
    projectRoot,
    ports: { ...ports },
  };
  writeState(state);
  log.step('Wrote state.json');

  // Run postSetup scripts
  for (const [pkgName, pkgConfig] of Object.entries(config.packages)) {
    if (!pkgConfig.postSetup?.length) continue;

    log.info(`Running postSetup for ${pkgName}`);
    for (const cmd of pkgConfig.postSetup) {
      log.step(cmd);
      const pkgDir = pkgConfig.directory ?? pkgName;
      execSync(cmd, { stdio: 'inherit', cwd: path.join(projectRoot, pkgDir) });
    }
  }

  // Update .claude/launch.json
  const hasFrontend = 'frontend' in config.packages;
  const hasBackend = 'backend' in config.packages;
  updateLaunchJson(projectRoot, ports, config.packages);

  // Print summary
  log.blank();
  log.success(`${projectName} setup complete (index ${index})`);
  log.blank();
  log.info('Port summary:');
  if (config.services.postgres)
    log.step(`PostgreSQL:  localhost:${ports.postgres}`);
  if (config.services.redis) log.step(`Redis:       localhost:${ports.redis}`);
  if (config.services.s3) {
    log.step(`S3 (API):    localhost:${ports.s3}`);
    log.step(`S3 (console): localhost:${ports.s3Console}`);
  }
  if (hasFrontend) log.step(`Frontend:    localhost:${ports.frontend}`);
  if (hasBackend) log.step(`Backend:     localhost:${ports.backend}`);
  log.blank();
  log.dim("Run 'pnpm dev' to start the development servers.");
}

/** Update .claude/launch.json with computed ports. */
function updateLaunchJson(
  projectRoot: string,
  ports: ReturnType<typeof computePorts>,
  packages: Record<string, PackageConfig>,
) {
  const launchPath = path.join(projectRoot, '.claude', 'launch.json');
  if (!fs.existsSync(launchPath)) return;

  const hasFrontend = 'frontend' in packages;
  const hasBackend = 'backend' in packages;

  try {
    const launch = JSON.parse(fs.readFileSync(launchPath, 'utf-8'));
    if (!Array.isArray(launch.configurations)) return;

    for (const config of launch.configurations) {
      if (hasFrontend && config.name === 'frontend') {
        const framework = packages.frontend?.framework ?? 'nextjs';
        const prefix = framework === 'vite' ? 'VITE_' : 'NEXT_PUBLIC_';
        config.port = ports.frontend;
        config.env = {
          ...config.env,
          ...(hasBackend && {
            [`${prefix}API_URL`]: `http://127.0.0.1:${ports.backend}`,
          }),
          [`${prefix}FRONTEND_URL`]: `http://127.0.0.1:${ports.frontend}`,
          [`${prefix}ASSET_SRC`]: `http://127.0.0.1:${ports.s3}`,
        };
      } else if (hasBackend && config.name === 'api') {
        config.port = ports.backend;
        config.env = {
          ...config.env,
          ...(hasFrontend && {
            FRONTEND_URL: `http://127.0.0.1:${ports.frontend}`,
          }),
        };
      }
    }

    fs.writeFileSync(launchPath, `${JSON.stringify(launch, null, 2)}\n`);
    log.step('Updated .claude/launch.json');
  } catch {
    log.warn('Could not update .claude/launch.json');
  }
}
