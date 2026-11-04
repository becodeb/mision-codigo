import { randomBytes } from 'node:crypto';

export interface AppConfig {
  production: boolean;
  host: string;
  port: number;
  dataDir: string;
  sessionSecret: string;
  /** Null disables the teacher login; there is never a default password. */
  adminPassword: string | null;
  cookieSecure: boolean;
  /**
   * How many reverse proxies to trust for the client address used by the login rate limit. A count, not
   * "all": trusting every hop would let a client choose its own address with a forged header.
   */
  trustProxy: number | false;
  /** Built client to serve, or null for API only. */
  staticDir: string | null;
}

type Env = Record<string, string | undefined>;

function blank(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === '' ? undefined : value;
}

export function loadConfig(env: Env, warn: (message: string) => void = console.warn): AppConfig {
  const production = env.NODE_ENV === 'production';
  let sessionSecret = blank(env.SESSION_SECRET);
  const adminPassword = blank(env.ADMIN_PASSWORD) ?? null;

  if (production) {
    const missing: string[] = [];
    if (sessionSecret === undefined) missing.push('SESSION_SECRET');
    if (adminPassword === null) missing.push('ADMIN_PASSWORD');
    if (missing.length > 0) {
      throw new Error(`Refusing to start in production without: ${missing.join(', ')}.`);
    }
  } else {
    if (sessionSecret === undefined) {
      sessionSecret = randomBytes(32).toString('hex');
      warn('WARNING: SESSION_SECRET is not set. Using a random secret; sessions end when the server restarts.');
    }
    if (adminPassword === null) {
      warn('WARNING: ADMIN_PASSWORD is not set. The teacher login is disabled.');
    }
  }

  const rawHops = blank(env.TRUST_PROXY);
  const hops = rawHops === undefined ? 0 : Number(rawHops);
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`Invalid TRUST_PROXY: ${rawHops}. Use the number of reverse proxies in front of the app.`);
  }

  const rawPort = blank(env.PORT) ?? '8301';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${rawPort}`);
  }

  return {
    production,
    host: blank(env.HOST) ?? '127.0.0.1',
    port,
    dataDir: blank(env.DATA_DIR) ?? './data',
    sessionSecret: sessionSecret as string,
    adminPassword,
    cookieSecure: env.COOKIE_SECURE === 'true',
    trustProxy: hops === 0 ? false : hops,
    staticDir: null,
  };
}
