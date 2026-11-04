import type { AddressInfo } from 'node:net';
import { createApp } from './app.ts';
import type { AppConfig } from './config.ts';
import { openDatabase } from './db.ts';

export const TEST_SECRET = 'test-secret-test-secret-test-secret';
export const TEST_PASSWORD = 'maestra-1234';

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    production: false,
    host: '127.0.0.1',
    port: 0,
    dataDir: ':memory:',
    sessionSecret: TEST_SECRET,
    adminPassword: TEST_PASSWORD,
    cookieSecure: false,
    trustProxy: false,
    staticDir: null,
    ...overrides,
  };
}

export interface Reply {
  status: number;
  headers: Headers;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
}

/** A tiny HTTP client that keeps cookies like a browser would. */
export interface Client {
  cookies: Map<string, string>;
  request(method: string, path: string, body?: unknown, raw?: string): Promise<Reply>;
  get(path: string): Promise<Reply>;
  post(path: string, body?: unknown): Promise<Reply>;
  put(path: string, body?: unknown): Promise<Reply>;
  patch(path: string, body?: unknown): Promise<Reply>;
  del(path: string): Promise<Reply>;
}

export interface TestServer {
  baseUrl: string;
  db: ReturnType<typeof openDatabase>;
  client(): Client;
  close(): Promise<void>;
}

export async function startTestServer(
  config: Partial<AppConfig> = {},
  now?: () => number,
): Promise<TestServer> {
  const db = openDatabase(':memory:');
  const app = createApp({ db, config: testConfig(config), now });
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  function client(): Client {
    const cookies = new Map<string, string>();
    const request: Client['request'] = async (method, path, body, raw) => {
      const headers: Record<string, string> = {};
      if (cookies.size > 0) headers.cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
      let payload: string | undefined;
      if (raw !== undefined) {
        payload = raw;
        headers['content-type'] = 'application/json';
      } else if (body !== undefined) {
        payload = JSON.stringify(body);
        headers['content-type'] = 'application/json';
      }
      const response = await fetch(baseUrl + path, { method, headers, body: payload });
      for (const line of response.headers.getSetCookie()) {
        const [pair, ...attrs] = line.split(';');
        const eq = pair.indexOf('=');
        const name = pair.slice(0, eq);
        const value = pair.slice(eq + 1);
        const expired = attrs.some((a) => a.trim().toLowerCase() === 'max-age=0');
        if (expired || value === '') cookies.delete(name);
        else cookies.set(name, value);
      }
      const text = await response.text();
      return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
    };
    return {
      cookies,
      request,
      get: (path) => request('GET', path),
      post: (path, body) => request('POST', path, body ?? {}),
      put: (path, body) => request('PUT', path, body ?? {}),
      patch: (path, body) => request('PATCH', path, body ?? {}),
      del: (path) => request('DELETE', path),
    };
  }

  return {
    baseUrl,
    db,
    client,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          db.close();
          resolve();
        });
      }),
  };
}

export const PROGRESS = {
  currentStep: 'fase-1-paso-2',
  completedSteps: [{ id: 'fase-1-paso-1', at: '2026-11-04T19:50:00.000Z' }],
  activeSeconds: 120,
  finished: false,
};

export async function loginAdmin(client: Client): Promise<void> {
  const reply = await client.post('/api/admin/session', { password: TEST_PASSWORD });
  if (reply.status !== 200) throw new Error('admin login failed in test setup');
}

export async function addStudent(
  admin: Client,
  name: string,
  group = '3° A',
  level = 3,
): Promise<number> {
  const reply = await admin.post('/api/admin/students', { name, group, level });
  return reply.body.student.id as number;
}
