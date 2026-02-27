import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkPrerequisites } from './prerequisites.js';

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

describe('checkPrerequisites', () => {
  it('does not exit when all tools are available', () => {
    vi.mocked(execFileSync).mockReturnValue('' as never);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    expect(() => checkPrerequisites()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('exits when docker is missing', () => {
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      if (Array.isArray(args) && args[0] === 'docker') {
        throw new Error('not found');
      }
      return '' as never;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    expect(() => checkPrerequisites()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when jq is missing', () => {
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      if (Array.isArray(args) && args[0] === 'jq') {
        throw new Error('not found');
      }
      return '' as never;
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
    expect(() => checkPrerequisites()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
