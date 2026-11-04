import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AppConfig } from './config.ts';
import { parseCookies, serializeCookie, signToken, verifyToken } from './cookies.ts';
import type { Store, StudentRow } from './db.ts';
import { AppError } from './errors.ts';

export const CHILD_COOKIE = 'mc_session';
export const ADMIN_COOKIE = 'mc_admin';
const CHILD_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_TTL_MS = 8 * 60 * 60 * 1000;

export function createAuth(config: AppConfig, store: Store, now: () => number) {
  function setCookie(res: Response, name: string, value: string, ttlMs: number): void {
    res.append('Set-Cookie', serializeCookie(name, value, Math.floor(ttlMs / 1000), config.cookieSecure));
  }
  function clearCookie(res: Response, name: string): void {
    res.append('Set-Cookie', serializeCookie(name, '', 0, config.cookieSecure));
  }

  function readToken(req: Request, name: string, purpose: 'child' | 'admin'): Record<string, unknown> | null {
    const token = parseCookies(req.headers.cookie)[name];
    if (!token) return null;
    const payload = verifyToken(config.sessionSecret, purpose, token);
    if (typeof payload !== 'object' || payload === null) return null;
    const claims = payload as Record<string, unknown>;
    if (typeof claims.exp !== 'number' || claims.exp <= now()) return null;
    return claims;
  }

  const hashPassword = (value: string) =>
    createHmac('sha256', config.sessionSecret).update(`password.${value}`).digest();
  const expectedPassword = config.adminPassword === null ? null : hashPassword(config.adminPassword);

  const requireChild: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const hadCookie = Boolean(parseCookies(req.headers.cookie)[CHILD_COOKIE]);
    const claims = readToken(req, CHILD_COOKIE, 'child');
    const student = claims && typeof claims.sid === 'number' ? store.getStudent(claims.sid) : null;
    if (!student) {
      if (hadCookie) clearCookie(res, CHILD_COOKIE);
      throw new AppError(401, 'no_session', 'Elegí tu nombre para empezar.');
    }
    res.locals.student = student;
    next();
  };

  const requireAdmin: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
    if (!readToken(req, ADMIN_COOKIE, 'admin')) {
      throw new AppError(401, 'admin_required', 'Ingresá con la contraseña de docente.');
    }
    next();
  };

  return {
    requireChild,
    requireAdmin,
    studentOf: (res: Response) => res.locals.student as StudentRow,
    isAdmin: (req: Request) => readToken(req, ADMIN_COOKIE, 'admin') !== null,
    loginEnabled: expectedPassword !== null,

    /** Constant-time comparison: both sides are hashed to the same length first. */
    passwordMatches(candidate: string): boolean {
      if (expectedPassword === null) return false;
      return timingSafeEqual(hashPassword(candidate), expectedPassword);
    },

    issueChild(res: Response, studentId: number): void {
      const token = signToken(config.sessionSecret, 'child', { sid: studentId, exp: now() + CHILD_TTL_MS });
      setCookie(res, CHILD_COOKIE, token, CHILD_TTL_MS);
    },
    clearChild: (res: Response) => clearCookie(res, CHILD_COOKIE),

    issueAdmin(res: Response): void {
      const token = signToken(config.sessionSecret, 'admin', { exp: now() + ADMIN_TTL_MS });
      setCookie(res, ADMIN_COOKIE, token, ADMIN_TTL_MS);
    },
    clearAdmin: (res: Response) => clearCookie(res, ADMIN_COOKIE),
  };
}

export type Auth = ReturnType<typeof createAuth>;
