import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VivariumState } from './registry.js';
import {
  autoAssignIndex,
  findExistingClaim,
  listClaimed,
  projectDir,
  readState,
  removeProject,
  writeState,
} from './registry.js';

vi.mock('node:child_process');
vi.mock('node:fs');
vi.mock('node:os', () => ({
  default: {
    homedir: vi.fn(() => '/mock-home'),
    platform: vi.fn(() => 'linux'),
  },
}));
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

const REGISTRY_DIR = '/mock-home/.local/share/vivarium';

const makeState = (overrides: Partial<VivariumState> = {}): VivariumState => ({
  index: 0,
  projectName: 'test-project',
  composeName: 'test-project',
  projectRoot: '/projects/test',
  ports: {
    postgres: 5433,
    redis: 6380,
    s3: 9010,
    s3Console: 9011,
    frontend: 4000,
    backend: 4001,
  },
  ...overrides,
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('projectDir', () => {
  it('returns correct path for a project', () => {
    expect(projectDir('my-project')).toBe(`${REGISTRY_DIR}/my-project`);
  });
});

describe('readState', () => {
  it('returns null when state.json does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(readState('no-such-project')).toBeNull();
  });

  it('parses and returns state when file exists', () => {
    const state = makeState();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(state) as never);
    const result = readState('test-project');
    expect(result).toEqual(state);
  });
});

describe('writeState', () => {
  it('creates dir and writes state as JSON', () => {
    const state = makeState();
    writeState(state);
    expect(vi.mocked(fs.mkdirSync)).toHaveBeenCalledWith(
      `${REGISTRY_DIR}/test-project`,
      { recursive: true },
    );
    expect(vi.mocked(fs.writeFileSync)).toHaveBeenCalledWith(
      `${REGISTRY_DIR}/test-project/state.json`,
      JSON.stringify(state, null, 2),
    );
  });
});

describe('removeProject', () => {
  it('removes the dir when it exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    removeProject('test-project');
    expect(vi.mocked(fs.rmSync)).toHaveBeenCalledWith(
      `${REGISTRY_DIR}/test-project`,
      {
        recursive: true,
      },
    );
  });

  it('no-op when dir does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    removeProject('missing-project');
    expect(vi.mocked(fs.rmSync)).not.toHaveBeenCalled();
  });
});

describe('listClaimed', () => {
  it('returns empty array when registry dir does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(listClaimed()).toEqual([]);
  });

  it('returns states from valid project directories', () => {
    const state = makeState({ projectName: 'project-a' });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'project-a', isDirectory: () => true } as never,
    ]);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(state) as never);
    const result = listClaimed();
    expect(result).toHaveLength(1);
    expect(result[0].projectName).toBe('project-a');
  });

  it('skips non-directory entries', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'some-file.txt', isDirectory: () => false } as never,
    ]);
    expect(listClaimed()).toEqual([]);
  });

  it('skips directories without state.json', () => {
    vi.mocked(fs.existsSync).mockImplementation(
      (p) => !String(p).endsWith('state.json'),
    );
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'project-a', isDirectory: () => true } as never,
    ]);
    expect(listClaimed()).toEqual([]);
  });

  it('skips directories with corrupted state.json', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'project-a', isDirectory: () => true } as never,
    ]);
    vi.mocked(fs.readFileSync).mockReturnValue('{ invalid json' as never);
    expect(listClaimed()).toEqual([]);
  });
});

describe('findExistingClaim', () => {
  it('returns null when no state exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(findExistingClaim('no-project')).toBeNull();
  });

  it('returns the state when it exists', () => {
    const state = makeState();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(state) as never);
    expect(findExistingClaim('test-project')).toEqual(state);
  });
});

describe('autoAssignIndex', () => {
  it('returns existing index if project is already claimed', () => {
    const state = makeState({ index: 5 });
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(state) as never);
    expect(autoAssignIndex('test-project')).toBe(5);
  });

  it('assigns index 0 when nothing is claimed', () => {
    // existsSync returns false for all paths → no existing claim, empty registry
    vi.mocked(fs.existsSync).mockReturnValue(false);
    // isPortInUse → execFileSync returns empty string → port not in use
    vi.mocked(execFileSync).mockReturnValue('' as never);
    expect(autoAssignIndex('new-project')).toBe(0);
  });

  it('skips taken indices and assigns next available', () => {
    const existingState = makeState({ index: 0, projectName: 'other-project' });

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pStr = String(p);
      // No existing claim for 'new-project'
      if (pStr.includes('new-project')) return false;
      // Registry dir exists
      if (pStr === REGISTRY_DIR) return true;
      // other-project/state.json exists
      if (pStr.includes('other-project/state.json')) return true;
      return false;
    });

    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'other-project', isDirectory: () => true } as never,
    ]);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify(existingState) as never,
    );
    vi.mocked(execFileSync).mockReturnValue('' as never);

    expect(autoAssignIndex('new-project')).toBe(1);
  });

  it('exits when all indices are exhausted', () => {
    // Simulate 100 claimed projects occupying indices 0–99
    const claimedStates: VivariumState[] = Array.from({ length: 100 }, (_, i) =>
      makeState({ index: i, projectName: `project-${i}` }),
    );

    vi.mocked(fs.existsSync).mockImplementation((p) => {
      const pStr = String(p);
      // overflow-project has no existing claim
      if (pStr.includes('overflow-project')) return false;
      if (pStr === REGISTRY_DIR) return true;
      if (pStr.endsWith('state.json')) return true;
      return false;
    });

    vi.mocked(fs.readdirSync).mockReturnValue(
      claimedStates.map((s) => ({
        name: s.projectName,
        isDirectory: () => true,
      })) as never,
    );

    let readCount = 0;
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      const state = claimedStates[readCount % claimedStates.length];
      readCount++;
      return JSON.stringify(state) as never;
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);

    expect(() => autoAssignIndex('overflow-project')).toThrow(
      'process.exit called',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
