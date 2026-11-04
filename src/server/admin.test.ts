import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROGRESS, TEST_PASSWORD, addStudent, loginAdmin, startTestServer } from './test-helpers.ts';
import type { Client, TestServer } from './test-helpers.ts';

let server: TestServer;
let admin: Client;

beforeEach(async () => {
  server = await startTestServer();
  admin = server.client();
});
afterEach(() => server.close());

describe('admin session', () => {
  it('logs in, reports status and logs out', async () => {
    expect((await admin.get('/api/admin/session')).body).toEqual({ authenticated: false, loginEnabled: true });
    expect((await admin.get('/api/admin/students')).status).toBe(401);

    const wrong = await admin.post('/api/admin/session', { password: 'nope' });
    expect(wrong.status).toBe(401);

    const ok = await admin.post('/api/admin/session', { password: TEST_PASSWORD });
    expect(ok.status).toBe(200);
    expect(ok.headers.getSetCookie().join('\n')).toMatch(/mc_admin=.*HttpOnly.*SameSite=Strict/);
    expect((await admin.get('/api/admin/session')).body.authenticated).toBe(true);
    expect((await admin.get('/api/admin/students')).status).toBe(200);

    await admin.del('/api/admin/session');
    expect((await admin.get('/api/admin/students')).status).toBe(401);
  });

  it('rejects a child cookie on admin routes, even renamed', async () => {
    await loginAdmin(admin);
    const id = await addStudent(admin, 'Luna');
    const child = server.client();
    await child.post('/api/session', { studentId: id });
    expect((await child.get('/api/admin/students')).status).toBe(401);
    expect((await child.get('/api/admin/progress')).status).toBe(401);

    const disguised = server.client();
    disguised.cookies.set('mc_admin', child.cookies.get('mc_session') as string);
    expect((await disguised.get('/api/admin/students')).status).toBe(401);
  });

  it('rejects a tampered admin cookie', async () => {
    await loginAdmin(admin);
    const good = admin.cookies.get('mc_admin') as string;
    const [body, sig] = good.split('.');
    admin.cookies.set('mc_admin', `${body}.${sig.slice(0, -2)}AA`);
    expect((await admin.get('/api/admin/students')).status).toBe(401);
    const forged = Buffer.from(JSON.stringify({ exp: Date.now() + 1e9 })).toString('base64url');
    admin.cookies.set('mc_admin', `${forged}.${sig}`);
    expect((await admin.get('/api/admin/students')).status).toBe(401);
  });

  it('rate limits logins: 5 failures, then 429 even with the right password, until the window passes', async () => {
    let clock = 1_000_000;
    await server.close();
    server = await startTestServer({}, () => clock);
    admin = server.client();

    for (let i = 0; i < 5; i++) {
      expect((await admin.post('/api/admin/session', { password: 'wrong' })).status).toBe(401);
    }
    const blocked = await admin.post('/api/admin/session', { password: TEST_PASSWORD });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('too_many_attempts');
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);

    clock += 15 * 60 * 1000 + 1;
    expect((await admin.post('/api/admin/session', { password: TEST_PASSWORD })).status).toBe(200);
  });

  it('disables login when no ADMIN_PASSWORD is configured', async () => {
    const open = await startTestServer({ adminPassword: null });
    try {
      const client = open.client();
      expect((await client.get('/api/admin/session')).body).toEqual({ authenticated: false, loginEnabled: false });
      const reply = await client.post('/api/admin/session', { password: '' });
      expect(reply.status).toBe(503);
      expect(reply.body.error.code).toBe('admin_disabled');
      expect((await client.get('/api/admin/students')).status).toBe(401);
    } finally {
      await open.close();
    }
  });
});

describe('admin students', () => {
  beforeEach(() => loginAdmin(admin));

  it('creates, lists, edits and deletes, rejecting duplicates and bad input', async () => {
    const created = await admin.post('/api/admin/students', { name: ' Luna ', group: '3° A', level: 4 });
    expect(created.status).toBe(201);
    expect(created.body.student).toMatchObject({ name: 'Luna', group: '3° A', level: 4 });
    const id = created.body.student.id;

    expect((await admin.post('/api/admin/students', { name: 'luna', group: '3° A', level: 1 })).status).toBe(409);
    expect((await admin.post('/api/admin/students', { name: 'Luna', group: '3° B', level: 1 })).status).toBe(201);
    expect((await admin.post('/api/admin/students', { name: 'X', group: 'A', level: 6 })).status).toBe(400);
    expect((await admin.post('/api/admin/students', { name: '', group: 'A', level: 1 })).status).toBe(400);

    const patched = await admin.patch(`/api/admin/students/${id}`, { level: 2 });
    expect(patched.body.student.level).toBe(2);
    expect((await admin.patch(`/api/admin/students/${id}`, { group: '3° B' })).status).toBe(409);
    expect((await admin.patch(`/api/admin/students/${id}`, {})).status).toBe(400);
    expect((await admin.patch('/api/admin/students/99999', { level: 2 })).status).toBe(404);
    expect((await admin.patch('/api/admin/students/abc', { level: 2 })).status).toBe(400);

    expect((await admin.get('/api/admin/students')).body.students).toHaveLength(2);
    expect((await admin.del(`/api/admin/students/${id}`)).status).toBe(200);
    expect((await admin.del(`/api/admin/students/${id}`)).status).toBe(404);
  });

  it('deleting a student deletes their projects', async () => {
    const id = await addStudent(admin, 'Luna');
    const child = server.client();
    await child.post('/api/session', { studentId: id });
    await child.put('/api/projects/libre', { project: {}, progress: PROGRESS });
    const count = () =>
      (server.db.prepare('SELECT COUNT(*) AS n FROM projects').get() as unknown as { n: number }).n;
    expect(count()).toBe(1);

    await admin.del(`/api/admin/students/${id}`);
    expect(count()).toBe(0);
    expect((await admin.get('/api/admin/progress')).body.entries).toEqual([]);
  });

  it('deletes one project of one student', async () => {
    const id = await addStudent(admin, 'Luna');
    const child = server.client();
    await child.post('/api/session', { studentId: id });
    await child.put('/api/projects/libre', { project: {}, progress: PROGRESS });
    await child.put('/api/projects/caza-pulpi', { project: {}, progress: PROGRESS });

    expect((await admin.del(`/api/admin/students/${id}/projects/libre`)).status).toBe(200);
    expect((await admin.del(`/api/admin/students/${id}/projects/libre`)).status).toBe(404);
    expect((await admin.del(`/api/admin/students/${id}/projects/Bad_Id`)).status).toBe(400);
    expect((await child.get('/api/projects')).body.projects.map((p: { gameId: string }) => p.gameId)).toEqual([
      'caza-pulpi',
    ]);
  });
});

describe('roster import', () => {
  beforeEach(() => loginAdmin(admin));

  it('imports valid lines, reports invalid ones and upserts by name + group', async () => {
    const text = [
      'Nombre, grupo, nivel',
      'Luna, 3° A, 4',
      'Mateo\t3° A\t2',
      '',
      'Sol, 2° B',
      'Pepe, 2° B, 9',
      ', 2° B, 1',
      'Ana, 2° B, 1',
    ].join('\n');
    const first = await admin.post('/api/admin/students/import', { text });
    expect(first.status).toBe(200);
    expect(first.body.created).toBe(3);
    expect(first.body.updated).toBe(0);
    expect(first.body.errors.map((e: { line: number }) => e.line)).toEqual([5, 6, 7]);
    expect(first.body.errors[0].message).toMatch(/3 columnas/);
    expect(first.body.errors[1].message).toMatch(/nivel/);

    const second = await admin.post('/api/admin/students/import', {
      text: 'luna, 3° a, 5\r\nNueva, 3° A, 1\r\nSin nivel, 3° A, x',
    });
    expect(second.body).toMatchObject({ created: 1, updated: 1 });
    expect(second.body.errors).toHaveLength(1);

    const students = (await admin.get('/api/admin/students')).body.students;
    expect(students).toHaveLength(4);
    expect(students.find((s: { name: string }) => s.name === 'Luna').level).toBe(5);
  });

  it('rejects a missing text field', async () => {
    expect((await admin.post('/api/admin/students/import', {})).status).toBe(400);
  });
});

describe('settings and progress', () => {
  beforeEach(() => loginAdmin(admin));

  it('changes the active class and rejects other values', async () => {
    expect((await admin.patch('/api/admin/settings', { activeClass: 2 })).body).toEqual({ activeClass: 2 });
    expect((await admin.patch('/api/admin/settings', { activeClass: 3 })).status).toBe(400);
    expect((await server.client().patch('/api/admin/settings', { activeClass: 1 })).status).toBe(401);
    expect((await server.client().get('/api/settings')).body.activeClass).toBe(2);
  });

  it('aggregates time and the steps where unfinished students are stopped', async () => {
    const sessions: Record<string, Client> = {};
    for (const name of ['Ana', 'Beto', 'Caro', 'Dani']) {
      const id = await addStudent(admin, name);
      sessions[name] = server.client();
      await sessions[name].post('/api/session', { studentId: id });
    }
    const save = (name: string, game: string, currentStep: string | null, seconds: number, finished = false, done = 1) =>
      sessions[name].put(`/api/projects/${game}`, {
        project: {},
        progress: {
          currentStep,
          completedSteps: Array.from({ length: done }, (_, i) => ({ id: `s${i}`, at: '2026-11-04T20:00:00.000Z' })),
          activeSeconds: seconds,
          finished,
        },
      });

    await save('Ana', 'tesoro', 'f1-s3', 600, false, 2);
    await save('Beto', 'tesoro', 'f1-s3', 300, false, 2);
    await save('Caro', 'tesoro', 'f1-s5', 900, false, 4);
    await save('Dani', 'tesoro', null, 1200, true, 8);
    await save('Ana', 'chispa', 'f2-s1', 100);

    const { body } = await admin.get('/api/admin/progress');
    expect(body.entries).toHaveLength(5);
    expect(body.entries.find((e: { name: string; gameId: string }) => e.name === 'Ana' && e.gameId === 'tesoro')).toMatchObject({
      currentStep: 'f1-s3',
      completedCount: 2,
      activeSeconds: 600,
      finished: false,
      level: 3,
      group: '3° A',
    });

    const tesoro = body.games.find((g: { gameId: string }) => g.gameId === 'tesoro');
    expect(tesoro).toMatchObject({ started: 4, finished: 1, averageActiveSeconds: 750 });
    expect(tesoro.stuckSteps).toEqual([
      { stepId: 'f1-s3', count: 2 },
      { stepId: 'f1-s5', count: 1 },
    ]);
    expect(body.games.find((g: { gameId: string }) => g.gameId === 'chispa').stuckSteps).toEqual([
      { stepId: 'f2-s1', count: 1 },
    ]);
  });
});
