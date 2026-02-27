import type { ServiceConfig, PostgresServiceConfig, S3ServiceConfig } from './config.js';
import type { PortMap } from './ports.js';

/**
 * Generate a Docker Compose YAML string from the configured services.
 * Uses template literals — no YAML library needed.
 */
export function generateCompose(
  services: ServiceConfig,
  ports: PortMap,
  composeName: string,
): string {
  const serviceBlocks: string[] = [];
  const volumeNames: string[] = [];

  if (services.postgres) {
    serviceBlocks.push(postgresBlock(services.postgres, ports));
    volumeNames.push('postgres-data');
  }

  if (services.redis) {
    serviceBlocks.push(redisBlock(ports));
    volumeNames.push('valkey-data');
  }

  if (services.s3) {
    serviceBlocks.push(s3Block(services.s3, ports));
    volumeNames.push('rustfs-data');
  }

  if (services.postgres) {
    serviceBlocks.push(postgresMcpBlock(services.postgres));
  }

  const volumesSection =
    volumeNames.length > 0
      ? `\nvolumes:\n${volumeNames.map((v) => `  ${v}:`).join('\n')}`
      : '';

  return `name: ${composeName}
services:
${serviceBlocks.join('\n\n')}
${volumesSection}
`;
}

function postgresBlock(_config: PostgresServiceConfig, _ports: PortMap): string {
  return `  postgres:
    image: "public.ecr.aws/docker/library/postgres:18-alpine"
    environment:
      POSTGRES_USER: \${POSTGRES_USER}
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: \${POSTGRES_DB}
    restart: unless-stopped
    ports:
      - "\${POSTGRES_PORT}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s`;
}

function redisBlock(_ports: PortMap): string {
  return `  valkey:
    image: "public.ecr.aws/valkey/valkey:8-alpine"
    ports:
      - "\${REDIS_PORT}:6379"
    volumes:
      - valkey-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "redis-cli ping | grep PONG"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s`;
}

function s3Block(_config: S3ServiceConfig, _ports: PortMap): string {
  return `  rustfs:
    image: public.ecr.aws/n9g5z2x9/docker-mirror/rustfs:latest
    command:
      - /data
    volumes:
      - rustfs-data:/data
    restart: unless-stopped
    environment:
      RUSTFS_ADDRESS: ":9010"
      RUSTFS_ACCESS_KEY: \${S3_ACCESS_KEY}
      RUSTFS_SECRET_KEY: \${S3_SECRET_KEY}
      RUSTFS_CONSOLE_ENABLE: "true"
    ports:
      - "\${S3_PORT}:9010"
      - "\${S3_CONSOLE_PORT}:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9010/health"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s`;
}

function postgresMcpBlock(_pgConfig: PostgresServiceConfig): string {
  return `  postgres-mcp:
    image: public.ecr.aws/n9g5z2x9/docker-mirror/postgres-mcp:latest
    command:
      - --access-mode=unrestricted
      - --transport=sse
    restart: unless-stopped
    environment:
      DATABASE_URI: postgres://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@postgres:5432/\${POSTGRES_DB}
    depends_on:
      postgres:
        condition: service_healthy
        restart: true`;
}
