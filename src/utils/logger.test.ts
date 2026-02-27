import { afterEach, describe, expect, it, vi } from 'vitest';

import { log } from './logger.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('log.info', () => {
  it('writes to console.log with the message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.info('hello info');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('hello info');
  });
});

describe('log.success', () => {
  it('writes to console.log with the message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.success('all done');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('all done');
  });
});

describe('log.warn', () => {
  it('writes to console.log with the message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.warn('be careful');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('be careful');
  });
});

describe('log.error', () => {
  it('writes to console.error with the message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    log.error('something failed');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('something failed');
  });
});

describe('log.step', () => {
  it('writes to console.log with the message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.step('doing step');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('doing step');
  });
});

describe('log.dim', () => {
  it('writes to console.log with the message', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.dim('debug info');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain('debug info');
  });
});

describe('log.blank', () => {
  it('writes an empty line to console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    log.blank();
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith();
  });
});
