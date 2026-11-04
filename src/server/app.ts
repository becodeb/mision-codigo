import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import type {
  AdminLoginRequest,
  AdminProgressResponse,
  AdminSessionResponse,
  AdminStudent,
  AdminStudentResponse,
  AdminStudentsResponse,
  ApiErrorBody,
  GameProgress,
  ImportStudentsResponse,
  OkResponse,
  ProjectResponse,
  ProjectsResponse,
  SaveProjectResponse,
  SessionResponse,
  SettingsResponse,
  StudentsResponse,
} from '../shared/api.ts';
import { GAME_ID_PATTERN, MAX_BODY_BYTES } from '../shared/api.ts';
import { KNOWN_GAME_IDS } from '../shared/gameIds.ts';
import type { ClassId, LevelId } from '../shared/levels.ts';
import { createAuth } from './auth.ts';
import type { AppConfig } from './config.ts';
import { createStore } from './db.ts';
import type { StudentRow } from './db.ts';
import { AppError } from './errors.ts';
import { parseRoster } from './importer.ts';
import { buildProgress, parseProgress } from './progress.ts';
import { createLoginLimiter } from './rateLimit.ts';

export interface AppDeps {
  db: DatabaseSync;
  config: AppConfig;
  /** Injectable clock for tests. */
  now?: () => number;
}

const levelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const classSchema = z.union([z.literal(1), z.literal(2)]);
const noControlChars = (value: string) => !/[\u0000-\u001f\u007f]/.test(value);
const nameSchema = z.string().trim().min(1).max(60).refine(noControlChars);
const groupSchema = z.string().trim().max(40).refine(noControlChars);

const sessionBody = z.object({ studentId: z.number().int().positive() });
const progressSchema = z.object({
  currentStep: z.string().max(80).nullable(),
  completedSteps: z.array(z.object({ id: z.string().max(80), at: z.string().max(40) })).max(500),
  activeSeconds: z.number().finite().min(0).max(10_000_000),
  finished: z.boolean(),
});
const saveBody = z.object({
  project: z.unknown().refine((value) => value !== undefined),
  progress: progressSchema,
});
const loginBody = z.object({ password: z.string().max(200) });
const createStudentBody = z.object({ name: nameSchema, group: groupSchema, level: levelSchema });
const updateStudentBody = z
  .object({ name: nameSchema.optional(), group: groupSchema.optional(), level: levelSchema.optional() })
  .refine((value) => Object.keys(value).length > 0);
const importBody = z.object({ text: z.string().max(200_000) });
const settingsBody = z.object({ activeClass: classSchema });

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new AppError(400, 'invalid_request', 'Los datos enviados no son válidos.');
  }
  return result.data;
}

function gameIdParam(req: Request): string {
  const gameId = String(req.params.gameId);
  if (!GAME_ID_PATTERN.test(gameId)) {
    throw new AppError(400, 'invalid_game_id', 'El identificador del juego no es válido.');
  }
  if (!KNOWN_GAME_IDS.has(gameId)) {
    throw new AppError(404, 'unknown_game', 'Ese juego no existe.');
  }
  return gameId;
}

function studentIdParam(req: Request): number {
  const raw = String(req.params.id);
  if (!/^\d{1,12}$/.test(raw)) throw new AppError(400, 'invalid_student_id', 'El identificador del alumno no es válido.');
  return Number(raw);
}

function toAdminStudent(student: StudentRow): AdminStudent {
  return { id: student.id, name: student.name, group: student.group, level: student.level, createdAt: student.createdAt };
}

export function createApp({ db, config, now = Date.now }: AppDeps) {
  const store = createStore(db, now);
  const auth = createAuth(config, store, now);
  const loginLimiter = createLoginLimiter({ now });

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    // The name screen lists children: it must never reach a search engine.
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  const api = express.Router();
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(express.json({ limit: MAX_BODY_BYTES }));

  // ---- Child ----

  api.get('/students', (_req, res) => {
    const body: StudentsResponse = {
      students: store.listStudents().map((s) => ({ id: s.id, name: s.name, group: s.group })),
    };
    res.json(body);
  });

  const sessionResponse = (student: StudentRow): SessionResponse => ({
    student: { id: student.id, name: student.name, group: student.group, level: student.level },
    activeClass: store.getActiveClass(),
  });

  api.post('/session', (req, res) => {
    const { studentId } = parse(sessionBody, req.body);
    const student = store.getStudent(studentId);
    if (!student) throw new AppError(404, 'student_not_found', 'No encontramos ese nombre.');
    auth.issueChild(res, student.id);
    res.json(sessionResponse(student));
  });

  api.get('/session', auth.requireChild, (_req, res) => {
    res.json(sessionResponse(auth.studentOf(res)));
  });

  api.delete('/session', (_req, res) => {
    auth.clearChild(res);
    const body: OkResponse = { ok: true };
    res.json(body);
  });

  api.get('/settings', (_req, res) => {
    const body: SettingsResponse = { activeClass: store.getActiveClass() };
    res.json(body);
  });

  api.get('/projects', auth.requireChild, (_req, res) => {
    const body: ProjectsResponse = {
      projects: store.listProjects(auth.studentOf(res).id).map((p) => ({
        gameId: p.gameId,
        progress: parseProgress(p.progress),
        updatedAt: p.updatedAt,
      })),
    };
    res.json(body);
  });

  api.get('/projects/:gameId', auth.requireChild, (req, res) => {
    const gameId = gameIdParam(req);
    const row = store.getProject(auth.studentOf(res).id, gameId);
    if (!row) throw new AppError(404, 'project_not_found', 'Todavía no hay un proyecto guardado para este juego.');
    const body: ProjectResponse = {
      gameId,
      project: JSON.parse(row.project),
      progress: parseProgress(row.progress),
      updatedAt: row.updatedAt,
    };
    res.json(body);
  });

  api.put('/projects/:gameId', auth.requireChild, (req, res) => {
    const gameId = gameIdParam(req);
    const { project, progress } = parse(saveBody, req.body);
    const updatedAt = store.saveProject(
      auth.studentOf(res).id,
      gameId,
      JSON.stringify(project),
      JSON.stringify(progress satisfies GameProgress),
    );
    const body: SaveProjectResponse = { gameId, updatedAt };
    res.json(body);
  });

  // ---- Teacher ----

  const admin = express.Router();

  admin.post('/session', (req, res) => {
    const { password } = parse(loginBody, req.body) satisfies AdminLoginRequest;
    if (!auth.loginEnabled) {
      throw new AppError(503, 'admin_disabled', 'El ingreso de docentes no está habilitado en este servidor.');
    }
    const key = req.ip ?? 'unknown';
    const wait = loginLimiter.blockedFor(key);
    if (wait > 0) {
      res.setHeader('Retry-After', String(wait));
      throw new AppError(429, 'too_many_attempts', 'Demasiados intentos. Esperá unos minutos y probá de nuevo.');
    }
    if (!auth.passwordMatches(password)) {
      loginLimiter.recordFailure(key);
      throw new AppError(401, 'wrong_password', 'La contraseña no es correcta.');
    }
    loginLimiter.reset(key);
    auth.issueAdmin(res);
    const body: OkResponse = { ok: true };
    res.json(body);
  });

  admin.get('/session', (req, res) => {
    const body: AdminSessionResponse = { authenticated: auth.isAdmin(req), loginEnabled: auth.loginEnabled };
    res.json(body);
  });

  admin.delete('/session', (_req, res) => {
    auth.clearAdmin(res);
    const body: OkResponse = { ok: true };
    res.json(body);
  });

  admin.use(auth.requireAdmin);

  admin.get('/students', (_req, res) => {
    const body: AdminStudentsResponse = { students: store.listStudents().map(toAdminStudent) };
    res.json(body);
  });

  admin.post('/students', (req, res) => {
    const input = parse(createStudentBody, req.body);
    if (store.findStudent(input.name, input.group)) {
      throw new AppError(409, 'student_exists', 'Ya hay un alumno con ese nombre en ese grupo.');
    }
    const body: AdminStudentResponse = { student: toAdminStudent(store.createStudent(input)) };
    res.status(201).json(body);
  });

  // Registered before /students/:id so "import" is never read as an id.
  admin.post('/students/import', (req, res) => {
    const { text } = parse(importBody, req.body);
    const { rows, errors } = parseRoster(text);
    const { created, updated } = store.upsertStudents(rows);
    const body: ImportStudentsResponse = { created, updated, errors };
    res.json(body);
  });

  admin.patch('/students/:id', (req, res) => {
    const id = studentIdParam(req);
    const patch = parse(updateStudentBody, req.body);
    const current = store.getStudent(id);
    if (!current) throw new AppError(404, 'student_not_found', 'No encontramos a ese alumno.');
    const twin = store.findStudent(patch.name ?? current.name, patch.group ?? current.group);
    if (twin && twin.id !== id) {
      throw new AppError(409, 'student_exists', 'Ya hay un alumno con ese nombre en ese grupo.');
    }
    const updated = store.updateStudent(id, patch as { name?: string; group?: string; level?: LevelId });
    const body: AdminStudentResponse = { student: toAdminStudent(updated as StudentRow) };
    res.json(body);
  });

  admin.delete('/students/:id', (req, res) => {
    if (!store.deleteStudent(studentIdParam(req))) {
      throw new AppError(404, 'student_not_found', 'No encontramos a ese alumno.');
    }
    const body: OkResponse = { ok: true };
    res.json(body);
  });

  admin.delete('/students/:id/projects/:gameId', (req, res) => {
    const studentId = studentIdParam(req);
    const gameId = gameIdParam(req);
    if (!store.deleteProject(studentId, gameId)) {
      throw new AppError(404, 'project_not_found', 'Ese alumno no tiene un proyecto guardado para este juego.');
    }
    const body: OkResponse = { ok: true };
    res.json(body);
  });

  admin.patch('/settings', (req, res) => {
    const { activeClass } = parse(settingsBody, req.body);
    store.setActiveClass(activeClass as ClassId);
    const body: SettingsResponse = { activeClass: store.getActiveClass() };
    res.json(body);
  });

  admin.get('/progress', (_req, res) => {
    const body: AdminProgressResponse = buildProgress(store.listProgressRows());
    res.json(body);
  });

  api.use('/admin', admin);

  api.use((_req, _res, next) => {
    next(new AppError(404, 'not_found', 'No encontramos lo que buscabas.'));
  });
  app.use('/api', api);

  // ---- Built client (optional) ----

  if (config.staticDir !== null && existsSync(join(config.staticDir, 'index.html'))) {
    const indexFile = join(config.staticDir, 'index.html');
    app.use(express.static(config.staticDir));
    /* Browsers ask for /favicon.ico on their own; the icon is Robi's SVG. */
    app.get('/favicon.ico', (_req, res) => res.redirect(302, '/favicon.svg'));
    app.use((req, res, next) => {
      const isDocument = (req.method === 'GET' || req.method === 'HEAD') && !/\.[a-z0-9]+$/i.test(req.path);
      if (isDocument) res.sendFile(indexFile);
      else next();
    });
  }

  // ---- Errors ----

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    let status = 500;
    let code = 'internal_error';
    let message = 'Algo salió mal. Probá de nuevo.';

    if (error instanceof AppError) {
      ({ status, code, message } = error);
    } else if (typeof error === 'object' && error !== null && 'type' in error) {
      const type = String((error as { type: unknown }).type);
      if (type === 'entity.too.large') {
        status = 413;
        code = 'payload_too_large';
        message = 'El proyecto es demasiado grande para guardarlo.';
      } else if (type === 'entity.parse.failed') {
        status = 400;
        code = 'invalid_json';
        message = 'Los datos enviados no son válidos.';
      } else if (type.startsWith('charset.') || type.startsWith('encoding.')) {
        status = 415;
        code = 'unsupported_encoding';
        message = 'No se puede leer ese formato de datos.';
      }
    }
    if (status === 500) console.error('Unhandled error:', error instanceof Error ? error.message : error);

    const body: ApiErrorBody = { error: { code, message } };
    res.status(status).json(body);
  });

  return app;
}
