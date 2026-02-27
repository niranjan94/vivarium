import { execFileSync } from 'node:child_process';
import { log } from './logger.js';

/**
 * Run a docker compose command with the given compose file and env file.
 * Inherits stdio so output streams to the terminal.
 */
export function dockerCompose(
  composeFile: string,
  envFile: string,
  args: string[],
  options?: { cwd?: string },
) {
  execFileSync(
    'docker',
    ['compose', '--file', composeFile, '--env-file', envFile, ...args],
    { stdio: 'inherit', cwd: options?.cwd },
  );
}

/**
 * Run an arbitrary docker command. Returns the result for inspection.
 */
export function docker(args: string[], options?: { stdio?: 'inherit' | 'pipe' }) {
  return execFileSync('docker', args, {
    stdio: options?.stdio ?? 'pipe',
    encoding: 'utf-8',
  });
}

/**
 * Create an S3 bucket via the aws CLI. Silently ignores "already exists" errors.
 */
export function createS3Bucket(endpoint: string, bucket: string, accessKey: string, secretKey: string) {
  try {
    execFileSync('aws', ['--endpoint-url', endpoint, 's3', 'mb', `s3://${bucket}`], {
      stdio: 'pipe',
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID: accessKey,
        AWS_SECRET_ACCESS_KEY: secretKey,
      },
    });
    log.step(`Created bucket: ${bucket}`);
  } catch {
    log.dim(`Bucket already exists: ${bucket}`);
  }
}
