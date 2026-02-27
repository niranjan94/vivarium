import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PackageConfig, VivariumConfig } from './config.js';
import {
  generateComposeEnv,
  generatePackageEnv,
  writePackageEnvFiles,
} from './env.js';
import type { PortMap } from './ports.js';

vi.mock('node:fs');
vi.mock('./utils/logger.js', () => ({
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

const mockPorts: PortMap = {
  postgres: 5433,
  redis: 6380,
  s3: 9010,
  s3Console: 9011,
  frontend: 4000,
  backend: 4001,
};

const fullConfig: VivariumConfig = {
  services: {
    postgres: { user: 'pguser', password: 'pgpass', database: 'mydb' },
    redis: true,
    s3: {
      accessKey: 'accesskey',
      secretKey: 'secretkey',
      buckets: ['main', 'temp'],
    },
  },
  packages: {
    backend: { envFile: 'apps/backend/.env' },
    frontend: { envFile: 'apps/frontend/.env' },
  },
};

afterEach(() => {
  vi.resetAllMocks();
});

describe('generateComposeEnv', () => {
  it('includes COMPOSE_PROJECT_NAME', () => {
    const result = generateComposeEnv(fullConfig, mockPorts, 'my-app');
    expect(result).toContain('COMPOSE_PROJECT_NAME=my-app');
  });

  it('includes postgres vars when configured', () => {
    const result = generateComposeEnv(fullConfig, mockPorts, 'my-app');
    expect(result).toContain('POSTGRES_PORT=5433');
    expect(result).toContain('POSTGRES_USER=pguser');
    expect(result).toContain('POSTGRES_PASSWORD=pgpass');
    expect(result).toContain('POSTGRES_DB=mydb');
  });

  it('includes redis port when configured', () => {
    const result = generateComposeEnv(fullConfig, mockPorts, 'my-app');
    expect(result).toContain('REDIS_PORT=6380');
  });

  it('includes s3 vars when configured', () => {
    const result = generateComposeEnv(fullConfig, mockPorts, 'my-app');
    expect(result).toContain('S3_PORT=9010');
    expect(result).toContain('S3_CONSOLE_PORT=9011');
    expect(result).toContain('S3_ACCESS_KEY=accesskey');
    expect(result).toContain('S3_SECRET_KEY=secretkey');
  });

  it('omits postgres vars when postgres not configured', () => {
    const config: VivariumConfig = { services: {}, packages: {} };
    const result = generateComposeEnv(config, mockPorts, 'my-app');
    expect(result).not.toContain('POSTGRES_PORT');
    expect(result).not.toContain('REDIS_PORT');
    expect(result).not.toContain('S3_PORT');
  });

  it('omits redis vars when redis not configured', () => {
    const config: VivariumConfig = {
      services: { postgres: { user: 'u', password: 'p', database: 'd' } },
      packages: {},
    };
    const result = generateComposeEnv(config, mockPorts, 'my-app');
    expect(result).not.toContain('REDIS_PORT');
  });
});

describe('generatePackageEnv (backend)', () => {
  it('includes API_LISTEN_PORT and API_URL', () => {
    const pkgConfig: PackageConfig = {};
    const result = generatePackageEnv(
      'backend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['backend', 'frontend'],
    );
    expect(result).toContain('API_LISTEN_PORT=4001');
    expect(result).toContain('API_URL=http://localhost:4001');
  });

  it('includes FRONTEND_URL when frontend package is present', () => {
    const pkgConfig: PackageConfig = {};
    const result = generatePackageEnv(
      'backend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['backend', 'frontend'],
    );
    expect(result).toContain('FRONTEND_URL=http://localhost:4000');
  });

  it('omits FRONTEND_URL when no frontend package', () => {
    const pkgConfig: PackageConfig = {};
    const result = generatePackageEnv(
      'backend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['backend'],
    );
    expect(result).not.toContain('FRONTEND_URL');
  });

  it('includes DATABASE_URL when postgres is configured', () => {
    const pkgConfig: PackageConfig = {};
    const result = generatePackageEnv(
      'backend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['backend'],
    );
    expect(result).toContain(
      'DATABASE_URL=postgresql://pguser:pgpass@localhost:5433/mydb',
    );
  });

  it('includes REDIS vars when redis is configured', () => {
    const pkgConfig: PackageConfig = {};
    const result = generatePackageEnv(
      'backend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['backend'],
    );
    expect(result).toContain('REDIS_ENABLED=true');
    expect(result).toContain('REDIS_URL=redis://localhost:6380/0');
    expect(result).toContain('REDIS_QUEUE_URL=redis://localhost:6380/1');
  });

  it('includes S3 vars with bucket names', () => {
    const pkgConfig: PackageConfig = {};
    const result = generatePackageEnv(
      'backend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['backend'],
    );
    expect(result).toContain('AWS_S3_REGION=us-east-1');
    expect(result).toContain('AWS_S3_ACCESS_KEY_ID=accesskey');
    expect(result).toContain('AWS_S3_SECRET_ACCESS_KEY=secretkey');
    expect(result).toContain('AWS_S3_ENDPOINT=http://localhost:9010');
    expect(result).toContain('AWS_S3_BUCKET_NAME=main');
    expect(result).toContain('AWS_S3_TEMP_BUCKET_NAME=temp');
  });

  it('custom env overrides conventions', () => {
    const pkgConfig: PackageConfig = {
      env: { API_URL: 'http://custom-api.com', CUSTOM_KEY: 'val' },
    };
    const result = generatePackageEnv(
      'backend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['backend'],
    );
    expect(result).toContain('API_URL=http://custom-api.com');
    expect(result).toContain('CUSTOM_KEY=val');
  });
});

describe('generatePackageEnv (frontend)', () => {
  it('uses NEXT_PUBLIC_ prefix by default (nextjs framework)', () => {
    const pkgConfig: PackageConfig = { framework: 'nextjs' };
    const result = generatePackageEnv(
      'frontend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['backend', 'frontend'],
    );
    expect(result).toContain('NEXT_PUBLIC_FRONTEND_URL=http://localhost:4000');
    expect(result).toContain('NEXT_PUBLIC_API_URL=http://localhost:4001');
  });

  it('uses VITE_ prefix when framework is vite', () => {
    const pkgConfig: PackageConfig = { framework: 'vite' };
    const result = generatePackageEnv(
      'frontend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['backend', 'frontend'],
    );
    expect(result).toContain('VITE_FRONTEND_URL=http://localhost:4000');
    expect(result).toContain('VITE_API_URL=http://localhost:4001');
  });

  it('includes PORT', () => {
    const pkgConfig: PackageConfig = {};
    const result = generatePackageEnv(
      'frontend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['frontend'],
    );
    expect(result).toContain('PORT=4000');
  });

  it('includes ASSET_SRC when s3 is configured', () => {
    const pkgConfig: PackageConfig = {};
    const result = generatePackageEnv(
      'frontend',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['frontend'],
    );
    expect(result).toContain('NEXT_PUBLIC_ASSET_SRC=http://localhost:9010');
  });
});

describe('generatePackageEnv (unknown package)', () => {
  it('only includes custom env entries for unknown packages', () => {
    const pkgConfig: PackageConfig = { env: { MY_VAR: 'hello' } };
    const result = generatePackageEnv(
      'worker',
      pkgConfig,
      fullConfig,
      mockPorts,
      ['worker'],
    );
    expect(result).toContain('MY_VAR=hello');
    expect(result).not.toContain('API_LISTEN_PORT');
    expect(result).not.toContain('PORT=');
  });
});

describe('writePackageEnvFiles', () => {
  it('writes env files for packages with envFile', () => {
    const config: VivariumConfig = {
      services: {},
      packages: {
        backend: { envFile: 'apps/backend/.env' },
      },
    };
    writePackageEnvFiles('/test-root', config, mockPorts);
    expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith(
      '/test-root/apps/backend',
      {
        recursive: true,
      },
    );
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      '/test-root/apps/backend/.env',
      expect.any(String),
    );
  });

  it('skips packages without envFile', () => {
    const config: VivariumConfig = {
      services: {},
      packages: {
        worker: {},
      },
    };
    writePackageEnvFiles('/test-root', config, mockPorts);
    expect(vi.mocked(fs.mkdirSync)).not.toHaveBeenCalled();
    expect(vi.mocked(fs.writeFileSync)).not.toHaveBeenCalled();
  });

  it('creates parent dirs recursively', () => {
    const config: VivariumConfig = {
      services: {},
      packages: {
        backend: { envFile: 'deep/nested/path/.env' },
      },
    };
    writePackageEnvFiles('/root', config, mockPorts);
    expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith(
      '/root/deep/nested/path',
      {
        recursive: true,
      },
    );
  });
});
