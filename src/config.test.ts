import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadConfig, loadProjectName } from './config.js';

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

const validConfig = {
  services: { postgres: { user: 'u', password: 'p', database: 'db' } },
  packages: { backend: {} },
};

afterEach(() => {
  vi.resetAllMocks();
});

describe('loadConfig', () => {
  it('loads from vivarium.json when it exists', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith('vivarium.json'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify(validConfig) as never,
    );
    const config = loadConfig('/project');
    expect(config.services.postgres).toBeDefined();
    expect(config.packages.backend).toBeDefined();
  });

  it('falls back to package.json vivarium key', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith('package.json'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: 'my-app', vivarium: validConfig }) as never,
    );
    const config = loadConfig('/project');
    expect(config.services).toBeDefined();
    expect(config.packages).toBeDefined();
  });

  it('prefers vivarium.json over package.json', () => {
    const vivariumOnlyConfig = {
      services: {},
      packages: { worker: {} },
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValueOnce(
      JSON.stringify(vivariumOnlyConfig) as never,
    );
    const config = loadConfig('/project');
    expect(Object.keys(config.packages)).toContain('worker');
  });

  it('exits when no config found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    expect(() => loadConfig('/project')).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when services key missing', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith('vivarium.json'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ packages: {} }) as never,
    );
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    expect(() => loadConfig('/project')).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when packages key missing', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith('vivarium.json'),
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ services: {} }) as never,
    );
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    expect(() => loadConfig('/project')).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe('loadProjectName', () => {
  it('reads name from package.json', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ name: 'my-cool-app' }) as never,
    );
    const name = loadProjectName('/projects/my-cool-app');
    expect(name).toBe('my-cool-app');
  });

  it('falls back to directory basename when package.json missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const name = loadProjectName('/projects/my-project');
    expect(name).toBe(path.basename('/projects/my-project'));
  });

  it('falls back to directory basename when name field missing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: '1.0.0' }) as never,
    );
    const name = loadProjectName('/projects/my-project');
    expect(name).toBe('my-project');
  });
});
