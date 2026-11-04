import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

describe('loadConfig', () => {
  it('refuses to start in production without secrets', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/SESSION_SECRET, ADMIN_PASSWORD/);
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 's' })).toThrow(/ADMIN_PASSWORD/);
    expect(() => loadConfig({ NODE_ENV: 'production', ADMIN_PASSWORD: 'p' })).toThrow(/SESSION_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', SESSION_SECRET: '  ', ADMIN_PASSWORD: 'p' })).toThrow();
    const config = loadConfig({ NODE_ENV: 'production', SESSION_SECRET: 's', ADMIN_PASSWORD: 'p' });
    expect(config).toMatchObject({ production: true, sessionSecret: 's', adminPassword: 'p' });
  });

  it('warns and generates a secret outside production; never defaults a password', () => {
    const warnings: string[] = [];
    const config = loadConfig({}, (m) => warnings.push(m));
    expect(config.sessionSecret.length).toBeGreaterThanOrEqual(32);
    expect(config.adminPassword).toBeNull();
    expect(warnings).toHaveLength(2);
    expect(loadConfig({}, () => {}).sessionSecret).not.toBe(config.sessionSecret);
  });

  it('defaults to a loopback host and port 8301, and reads overrides', () => {
    const defaults = loadConfig({ SESSION_SECRET: 's', ADMIN_PASSWORD: 'p' });
    expect(defaults).toMatchObject({ host: '127.0.0.1', port: 8301, dataDir: './data', cookieSecure: false });
    const custom = loadConfig({
      SESSION_SECRET: 's',
      ADMIN_PASSWORD: 'p',
      HOST: '192.168.1.5',
      PORT: '9000',
      DATA_DIR: '/var/lib/mc',
      COOKIE_SECURE: 'true',
    });
    expect(custom).toMatchObject({ host: '192.168.1.5', port: 9000, dataDir: '/var/lib/mc', cookieSecure: true });
    expect(() => loadConfig({ SESSION_SECRET: 's', PORT: 'abc' }, () => {})).toThrow(/PORT/);
  });

  it('makes the real entry point exit non-zero in production without secrets', () => {
    const result = spawnSync(process.execPath, ['src/server/index.ts'], {
      env: { PATH: process.env.PATH, NODE_ENV: 'production', PORT: '0' },
      encoding: 'utf8',
      timeout: 15000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('SESSION_SECRET');
  });
});
