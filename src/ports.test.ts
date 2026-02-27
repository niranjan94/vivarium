import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { computePorts, isPortInUse } from './ports.js';

vi.mock('node:child_process');
vi.mock('node:os');

describe('computePorts', () => {
  it('returns correct ports for index 0', () => {
    const ports = computePorts(0);
    expect(ports.postgres).toBe(5433);
    expect(ports.redis).toBe(6380);
    expect(ports.s3).toBe(9010);
    expect(ports.s3Console).toBe(9011);
    expect(ports.frontend).toBe(4000);
    expect(ports.backend).toBe(4001);
  });

  it('returns correct ports for index 1', () => {
    const ports = computePorts(1);
    expect(ports.postgres).toBe(5434);
    expect(ports.redis).toBe(6381);
    expect(ports.s3).toBe(9020);
    expect(ports.s3Console).toBe(9021);
    expect(ports.frontend).toBe(4010);
    expect(ports.backend).toBe(4011);
  });

  it('returns correct ports for index 99', () => {
    const ports = computePorts(99);
    expect(ports.postgres).toBe(5532);
    expect(ports.redis).toBe(6479);
    expect(ports.s3).toBe(10000);
    expect(ports.s3Console).toBe(10001);
    expect(ports.frontend).toBe(4990);
    expect(ports.backend).toBe(4991);
  });

  it('has no port overlaps within a single index', () => {
    for (let i = 0; i < 100; i++) {
      const ports = computePorts(i);
      const values = Object.values(ports);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    }
  });

  it('has no port overlaps between any two indices (0–99)', () => {
    const seen = new Map<number, number>();
    for (let i = 0; i < 100; i++) {
      const ports = computePorts(i);
      for (const port of Object.values(ports)) {
        expect(
          seen.has(port),
          `Port ${port} at index ${i} already used by index ${seen.get(port)}`,
        ).toBe(false);
        seen.set(port, i);
      }
    }
  });
});

describe('isPortInUse', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('returns true when lsof finds listener on darwin', () => {
    vi.mocked(os.platform).mockReturnValue('darwin');
    vi.mocked(execFileSync).mockReturnValue('some output\n' as never);
    expect(isPortInUse(5432)).toBe(true);
  });

  it('uses ss on linux and returns true when output is non-empty', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(execFileSync).mockReturnValue(
      'LISTEN 0 128 *:5432 *:*\n' as never,
    );
    expect(isPortInUse(5432)).toBe(true);
  });

  it('returns false when lsof returns empty string', () => {
    vi.mocked(os.platform).mockReturnValue('darwin');
    vi.mocked(execFileSync).mockReturnValue('  \n' as never);
    expect(isPortInUse(5432)).toBe(false);
  });

  it('returns false when command throws', () => {
    vi.mocked(os.platform).mockReturnValue('linux');
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('command not found');
    });
    expect(isPortInUse(5432)).toBe(false);
  });
});
