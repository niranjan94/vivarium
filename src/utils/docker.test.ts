import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createS3Bucket, docker, dockerCompose } from './docker.js';

vi.mock('node:child_process');
vi.mock('./logger.js', () => ({
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    step: vi.fn(),
    dim: vi.fn(),
    blank: vi.fn(),
  },
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe('dockerCompose', () => {
  it('calls execFileSync with correct args', () => {
    dockerCompose('/path/to/compose.yaml', '/path/to/.env', ['up', '-d']);
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'docker',
      [
        'compose',
        '--file',
        '/path/to/compose.yaml',
        '--env-file',
        '/path/to/.env',
        'up',
        '-d',
      ],
      { stdio: 'inherit', cwd: undefined },
    );
  });

  it('passes cwd option when provided', () => {
    dockerCompose('/compose.yaml', '/.env', ['ps'], { cwd: '/my-project' });
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'docker',
      expect.any(Array),
      { stdio: 'inherit', cwd: '/my-project' },
    );
  });
});

describe('docker', () => {
  it('calls execFileSync with correct args and returns stdout', () => {
    vi.mocked(execFileSync).mockReturnValue('container-id\n' as never);
    const result = docker(['ps', '-q']);
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'docker',
      ['ps', '-q'],
      {
        stdio: 'pipe',
        encoding: 'utf-8',
      },
    );
    expect(result).toBe('container-id\n');
  });

  it('respects stdio override', () => {
    docker(['logs', 'mycontainer'], { stdio: 'inherit' });
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'docker',
      ['logs', 'mycontainer'],
      { stdio: 'inherit', encoding: 'utf-8' },
    );
  });
});

describe('createS3Bucket', () => {
  it('calls aws CLI with correct args and env', () => {
    createS3Bucket(
      'http://localhost:9010',
      'my-bucket',
      'access123',
      'secret456',
    );
    expect(vi.mocked(execFileSync)).toHaveBeenCalledWith(
      'aws',
      ['--endpoint-url', 'http://localhost:9010', 's3', 'mb', 's3://my-bucket'],
      expect.objectContaining({
        stdio: 'pipe',
        env: expect.objectContaining({
          AWS_ACCESS_KEY_ID: 'access123',
          AWS_SECRET_ACCESS_KEY: 'secret456',
        }),
      }),
    );
  });

  it('silently handles errors without throwing', () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('bucket already exists');
    });
    expect(() =>
      createS3Bucket('http://localhost:9010', 'bucket', 'k', 's'),
    ).not.toThrow();
  });
});
