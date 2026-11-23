import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function load(prod) {
  vi.resetModules(); vi.stubEnv('PROD', prod);
  return (await import('./logger.js')).logger;
}
beforeEach(() => { for (const m of ['debug', 'info', 'warn', 'error']) vi.spyOn(console, m).mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('client logger', () => {
  it('prefixes messages and forwards to the matching console method', async () => {
    const logger = await load(false);
    logger.info('hello'); logger.warn('w'); logger.error('e');
    expect(console.info).toHaveBeenCalledWith('[apmc] hello', '');
    expect(console.warn).toHaveBeenCalledWith('[apmc] w', '');
    expect(console.error).toHaveBeenCalledWith('[apmc] e', '');
  });
  it('emits debug in development', async () => {
    (await load(false)).debug('d');
    expect(console.debug).toHaveBeenCalled();
  });
  it('suppresses debug in production but not other levels', async () => {
    const logger = await load(true);
    logger.debug('d'); logger.info('i');
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalled();
  });
  it('redacts sensitive keys at depth, case-insensitively, without mutating input', async () => {
    const logger = await load(false);
    const meta = { password: 'p', ok: 1, nested: { Token: 't', list: [{ authorization: 'a', keep: 2 }] }, secret: 's', passwordHash: 'h' };
    logger.info('m', meta);
    const logged = console.info.mock.calls[0][1];
    expect(logged).toEqual({ password: '[REDACTED]', ok: 1, nested: { Token: '[REDACTED]', list: [{ authorization: '[REDACTED]', keep: 2 }] }, secret: '[REDACTED]', passwordHash: '[REDACTED]' });
    expect(meta.password).toBe('p');
  });
});
