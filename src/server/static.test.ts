import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestServer } from './test-helpers.ts';
import type { TestServer } from './test-helpers.ts';

let dir: string;
let server: TestServer;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'mc-static-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>x</title>');
  writeFileSync(join(dir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  server = await startTestServer({ staticDir: dir });
});
afterEach(async () => {
  await server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('built client', () => {
  it('answers the favicon request the browser makes on its own, so the console stays clean', async () => {
    const res = await fetch(`${server.baseUrl}/favicon.ico`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
  });

  it('serves the page for any path without a file extension', async () => {
    const res = await fetch(`${server.baseUrl}/alguna/ruta`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>x</title>');
  });
});
