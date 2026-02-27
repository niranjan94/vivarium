import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { generateCompose } from './compose.js';
import type { ServiceConfig } from './config.js';
import type { PortMap } from './ports.js';

const mockPorts: PortMap = {
  postgres: 5433,
  redis: 6380,
  s3: 9010,
  s3Console: 9011,
  frontend: 4000,
  backend: 4001,
};

const allServices: ServiceConfig = {
  postgres: { user: 'pguser', password: 'pgpass', database: 'mydb' },
  redis: true,
  s3: { accessKey: 'access', secretKey: 'secret', buckets: ['mybucket'] },
};

describe('generateCompose', () => {
  it('all services enabled → correct service names present', () => {
    const result = generateCompose(allServices, mockPorts, 'test-app');
    const parsed = parse(result);
    expect(Object.keys(parsed.services)).toContain('postgres');
    expect(Object.keys(parsed.services)).toContain('valkey');
    expect(Object.keys(parsed.services)).toContain('rustfs');
    expect(Object.keys(parsed.services)).toContain('postgres-mcp');
  });

  it('all services enabled → volumes declared for each service', () => {
    const result = generateCompose(allServices, mockPorts, 'test-app');
    const parsed = parse(result);
    expect(Object.keys(parsed.volumes)).toContain('postgres-data');
    expect(Object.keys(parsed.volumes)).toContain('valkey-data');
    expect(Object.keys(parsed.volumes)).toContain('rustfs-data');
  });

  it('postgres only → generates postgres and postgres-mcp, no valkey or rustfs', () => {
    const services: ServiceConfig = {
      postgres: { user: 'u', password: 'p', database: 'db' },
    };
    const result = generateCompose(services, mockPorts, 'pg-only');
    const parsed = parse(result);
    expect(Object.keys(parsed.services)).toContain('postgres');
    expect(Object.keys(parsed.services)).toContain('postgres-mcp');
    expect(Object.keys(parsed.services)).not.toContain('valkey');
    expect(Object.keys(parsed.services)).not.toContain('rustfs');
  });

  it('redis only → generates valkey, no postgres or rustfs', () => {
    const services: ServiceConfig = { redis: true };
    const result = generateCompose(services, mockPorts, 'redis-only');
    const parsed = parse(result);
    expect(Object.keys(parsed.services)).toContain('valkey');
    expect(Object.keys(parsed.services)).not.toContain('postgres');
    expect(Object.keys(parsed.services)).not.toContain('postgres-mcp');
    expect(Object.keys(parsed.services)).not.toContain('rustfs');
  });

  it('s3 only → generates rustfs, no postgres or valkey', () => {
    const services: ServiceConfig = {
      s3: { accessKey: 'key', secretKey: 'secret', buckets: [] },
    };
    const result = generateCompose(services, mockPorts, 's3-only');
    const parsed = parse(result);
    expect(Object.keys(parsed.services)).toContain('rustfs');
    expect(Object.keys(parsed.services)).not.toContain('postgres');
    expect(Object.keys(parsed.services)).not.toContain('valkey');
  });

  it('empty services → valid YAML with empty services object', () => {
    const services: ServiceConfig = {};
    const result = generateCompose(services, mockPorts, 'empty');
    const parsed = parse(result);
    expect(parsed.services).toBeDefined();
    expect(Object.keys(parsed.services)).toHaveLength(0);
    expect(parsed.volumes).toBeUndefined();
  });

  it('postgres healthcheck has correct shape', () => {
    const services: ServiceConfig = {
      postgres: { user: 'u', password: 'p', database: 'db' },
    };
    const result = generateCompose(services, mockPorts, 'hc-test');
    const parsed = parse(result);
    const hc = parsed.services.postgres.healthcheck;
    expect(hc.interval).toBe('10s');
    expect(hc.timeout).toBe('5s');
    expect(hc.retries).toBe(5);
    expect(hc.start_period).toBe('30s');
    expect(hc.test[0]).toBe('CMD-SHELL');
  });

  it('postgres-mcp depends_on postgres with service_healthy condition', () => {
    const services: ServiceConfig = {
      postgres: { user: 'u', password: 'p', database: 'db' },
    };
    const result = generateCompose(services, mockPorts, 'dep-test');
    const parsed = parse(result);
    const dep = parsed.services['postgres-mcp'].depends_on;
    expect(dep.postgres).toBeDefined();
    expect(dep.postgres.condition).toBe('service_healthy');
    expect(dep.postgres.restart).toBe(true);
  });

  it('YAML contains ${S3_PORT} interpolation variable', () => {
    const services: ServiceConfig = {
      s3: { accessKey: 'key', secretKey: 'secret', buckets: [] },
    };
    const result = generateCompose(services, mockPorts, 'interp-test');
    expect(result).toContain('${S3_PORT}');
  });

  it('YAML contains ${POSTGRES_PORT} interpolation variable', () => {
    const services: ServiceConfig = {
      postgres: { user: 'u', password: 'p', database: 'db' },
    };
    const result = generateCompose(services, mockPorts, 'interp-test');
    expect(result).toContain('${POSTGRES_PORT}');
  });

  it('output is valid parseable YAML', () => {
    const result = generateCompose(allServices, mockPorts, 'parse-test');
    expect(() => parse(result)).not.toThrow();
    const parsed = parse(result);
    expect(parsed.name).toBe('parse-test');
  });

  it('compose name is set correctly', () => {
    const result = generateCompose({}, mockPorts, 'my-project');
    const parsed = parse(result);
    expect(parsed.name).toBe('my-project');
  });
});
