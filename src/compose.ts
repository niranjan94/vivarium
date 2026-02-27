/** biome-ignore-all lint/suspicious/noTemplateCurlyInString: these are meant for docker compose */
import { stringify } from 'yaml';

import type { ServiceConfig } from './config.js';
import type { PortMap } from './ports.js';

/** A single service entry in a Docker Compose file. */
interface ComposeService {
  image: string;
  command?: string[];
  environment?: Record<string, string>;
  ports?: string[];
  volumes?: string[];
  restart?: string;
  healthcheck?: {
    test: string[];
    interval: string;
    timeout: string;
    retries: number;
    start_period: string;
  };
  depends_on?: Record<string, { condition: string; restart: boolean }>;
}

/** Top-level Docker Compose file structure. */
interface ComposeFile {
  name: string;
  services: Record<string, ComposeService>;
  volumes?: Record<string, null>;
}

/**
 * Generate a Docker Compose YAML string from the configured services.
 * Builds a structured object and serializes it via the `yaml` library.
 */
export function generateCompose(
  services: ServiceConfig,
  _ports: PortMap,
  composeName: string,
): string {
  const composeServices: Record<string, ComposeService> = {};
  const volumeNames: string[] = [];

  if (services.postgres) {
    composeServices.postgres = postgresService();
    volumeNames.push('postgres-data');
  }

  if (services.redis) {
    composeServices.valkey = valkeyService();
    volumeNames.push('valkey-data');
  }

  if (services.s3) {
    composeServices.rustfs = rustfsService();
    volumeNames.push('rustfs-data');
  }

  if (services.postgres) {
    composeServices['postgres-mcp'] = postgresMcpService();
  }

  const compose: ComposeFile = {
    name: composeName,
    services: composeServices,
  };

  if (volumeNames.length > 0) {
    compose.volumes = Object.fromEntries(volumeNames.map((v) => [v, null]));
  }

  return stringify(compose, { lineWidth: 0, nullStr: '' });
}

/** PostgreSQL service definition. */
function postgresService(): ComposeService {
  return {
    image: 'public.ecr.aws/docker/library/postgres:18-alpine',
    environment: {
      POSTGRES_USER: '${POSTGRES_USER}',
      POSTGRES_PASSWORD: '${POSTGRES_PASSWORD}',
      POSTGRES_DB: '${POSTGRES_DB}',
    },
    restart: 'unless-stopped',
    ports: ['${POSTGRES_PORT}:5432'],
    volumes: ['postgres-data:/var/lib/postgresql'],
    healthcheck: {
      test: [
        'CMD-SHELL',
        'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB || exit 1',
      ],
      interval: '10s',
      timeout: '5s',
      retries: 5,
      start_period: '30s',
    },
  };
}

/** Valkey (Redis-compatible) service definition. */
function valkeyService(): ComposeService {
  return {
    image: 'public.ecr.aws/valkey/valkey:8-alpine',
    ports: ['${REDIS_PORT}:6379'],
    volumes: ['valkey-data:/data'],
    restart: 'unless-stopped',
    healthcheck: {
      test: ['CMD-SHELL', 'redis-cli ping | grep PONG'],
      interval: '10s',
      timeout: '5s',
      retries: 5,
      start_period: '10s',
    },
  };
}

/** RustFS (S3-compatible) service definition. */
function rustfsService(): ComposeService {
  return {
    image: 'public.ecr.aws/n9g5z2x9/docker-mirror/rustfs:latest',
    command: ['/data'],
    volumes: ['rustfs-data:/data'],
    restart: 'unless-stopped',
    environment: {
      RUSTFS_ADDRESS: ':9010',
      RUSTFS_ACCESS_KEY: '${S3_ACCESS_KEY}',
      RUSTFS_SECRET_KEY: '${S3_SECRET_KEY}',
      RUSTFS_CONSOLE_ENABLE: 'true',
    },
    ports: ['${S3_PORT}:9010', '${S3_CONSOLE_PORT}:9001'],
    healthcheck: {
      test: ['CMD', 'curl', '-f', 'http://localhost:9010/health'],
      interval: '10s',
      timeout: '5s',
      retries: 5,
      start_period: '10s',
    },
  };
}

/** PostgreSQL MCP sidecar service definition. */
function postgresMcpService(): ComposeService {
  return {
    image: 'public.ecr.aws/n9g5z2x9/docker-mirror/postgres-mcp:latest',
    command: ['--access-mode=unrestricted', '--transport=sse'],
    restart: 'unless-stopped',
    environment: {
      DATABASE_URI:
        'postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}',
    },
    depends_on: {
      postgres: {
        condition: 'service_healthy',
        restart: true,
      },
    },
  };
}
