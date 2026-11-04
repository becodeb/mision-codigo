import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PROGRESS, TEST_SECRET, addStudent, loginAdmin, startTestServer } from './test-helpers.ts';
import type { TestServer } from './test-helpers.ts';
import { signToken } from './cookies.ts';

let server: TestServer;
let lunaId: number;

beforeEach(async () => {
  server = await startTestServer();
  const admin = server.client();
  await loginAdmin(admin);
  lunaId = await addStudent(admin, 'Luna', '3° A', 4);
  await addStudent(admin, 'Mateo', '3° A', 2);
});
afterEach(() => server.close());

describe('child session', () => {
  it('lists names without levels, then signs in, reads and signs out', async () => {
    const child = server.client();
    const list = await child.get('/api/students');
    expect(list.status).toBe(200);
    expect(list.body.students).toEqual([
      { id: lunaId, name: 'Luna', group: '3° A' },
      { id: expect.any(Number), name: 'Mateo', group: '3° A' },
    ]);

    expect((await child.get('/api/session')).status).toBe(401);

    const login = await child.post('/api/session', { studentId: lunaId });
    expect(login.status).toBe(200);
    expect(login.body).toEqual({
      student: { id: lunaId, name: 'Luna', group: '3° A', level: 4 },
      activeClass: 1,
    });
    const setCookie = login.headers.getSetCookie().join('\n');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');
    expect(setCookie).not.toContain('Secure');

    expect((await child.get('/api/session')).body.student.name).toBe('Luna');

    expect((await child.del('/api/session')).status).toBe(200);
    expect((await child.get('/api/session')).status).toBe(401);
  });

  it('answers 404 for an unknown student and sets Secure when configured', async () => {
    const child = server.client();
    const missing = await child.post('/api/session', { studentId: 9999 });
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('student_not_found');

    const secure = await startTestServer({ cookieSecure: true });
    try {
      const admin = secure.client();
      await loginAdmin(admin);
      const id = await addStudent(admin, 'Sol');
      const login = await secure.client().post('/api/session', { studentId: id });
      expect(login.headers.getSetCookie().join('\n')).toContain('Secure');
    } finally {
      await secure.close();
    }
  });

  it('rejects a deleted student with 401 and clears the cookie', async () => {
    const child = server.client();
    await child.post('/api/session', { studentId: lunaId });
    const admin = server.client();
    await loginAdmin(admin);
    await admin.del(`/api/admin/students/${lunaId}`);

    const reply = await child.get('/api/session');
    expect(reply.status).toBe(401);
    expect(reply.headers.getSetCookie().join('\n')).toContain('Max-Age=0');
    expect(child.cookies.has('mc_session')).toBe(false);
  });

  it('rejects a tampered or foreign-signed cookie', async () => {
    const child = server.client();
    await child.post('/api/session', { studentId: lunaId });
    const good = child.cookies.get('mc_session') as string;

    const [body, sig] = good.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ sid: 2, exp: Date.now() + 1e9 })).toString('base64url');
    for (const bad of [`${forgedBody}.${sig}`, `${body}.${sig.slice(0, -2)}xx`, 'garbage', `${body}.`]) {
      child.cookies.set('mc_session', bad);
      expect((await child.get('/api/session')).status).toBe(401);
    }

    const wrongSecret = signToken('another-secret', 'child', { sid: lunaId, exp: Date.now() + 1e9 });
    child.cookies.set('mc_session', wrongSecret);
    expect((await child.get('/api/session')).status).toBe(401);

    const wrongPurpose = signToken(TEST_SECRET, 'admin', { sid: lunaId, exp: Date.now() + 1e9 });
    child.cookies.set('mc_session', wrongPurpose);
    expect((await child.get('/api/session')).status).toBe(401);

    const expired = signToken(TEST_SECRET, 'child', { sid: lunaId, exp: Date.now() - 1000 });
    child.cookies.set('mc_session', expired);
    expect((await child.get('/api/session')).status).toBe(401);
  });

  it('reports the active class', async () => {
    const child = server.client();
    expect((await child.get('/api/settings')).body).toEqual({ activeClass: 1 });
    const admin = server.client();
    await loginAdmin(admin);
    await admin.patch('/api/admin/settings', { activeClass: 2 });
    expect((await child.get('/api/settings')).body).toEqual({ activeClass: 2 });
    await child.post('/api/session', { studentId: lunaId });
    expect((await child.get('/api/session')).body.activeClass).toBe(2);
  });
});

describe('projects', () => {
  async function signedIn() {
    const child = server.client();
    await child.post('/api/session', { studentId: lunaId });
    return child;
  }

  it('requires a session', async () => {
    const reply = await server.client().get('/api/projects');
    expect(reply.status).toBe(401);
    expect(reply.body.error.code).toBe('no_session');
  });

  it('saves, loads, overwrites and lists metadata without the project JSON', async () => {
    const child = await signedIn();
    expect((await child.get('/api/projects/caza-pulpi')).status).toBe(404);

    const project = { sprites: [{ id: 'a', blocks: [{ type: 'move', fields: { steps: 10 } }] }] };
    const saved = await child.put('/api/projects/caza-pulpi', { project, progress: PROGRESS });
    expect(saved.status).toBe(200);
    expect(saved.body.gameId).toBe('caza-pulpi');

    const loaded = await child.get('/api/projects/caza-pulpi');
    expect(loaded.body.project).toEqual(project);
    expect(loaded.body.progress).toEqual(PROGRESS);

    await child.put('/api/projects/caza-pulpi', {
      project: { v: 2 },
      progress: { ...PROGRESS, activeSeconds: 300, finished: true },
    });
    await child.put('/api/projects/libre', { project: null, progress: { ...PROGRESS, currentStep: null } });

    const list = await child.get('/api/projects');
    expect(list.body.projects).toHaveLength(2);
    const pulpi = list.body.projects.find((p: { gameId: string }) => p.gameId === 'caza-pulpi');
    expect(pulpi.progress).toMatchObject({ activeSeconds: 300, finished: true });
    expect(pulpi).not.toHaveProperty('project');
    expect((await child.get('/api/projects/caza-pulpi')).body.project).toEqual({ v: 2 });
  });

  it('keeps projects separate per student and restores them on another browser', async () => {
    const first = await signedIn();
    await first.put('/api/projects/libre', { project: { mine: true }, progress: PROGRESS });

    const other = server.client();
    const list = await server.client().get('/api/students');
    const mateo = list.body.students.find((s: { name: string }) => s.name === 'Mateo');
    await other.post('/api/session', { studentId: mateo.id });
    expect((await other.get('/api/projects')).body.projects).toEqual([]);

    const elsewhere = server.client();
    await elsewhere.post('/api/session', { studentId: lunaId });
    expect((await elsewhere.get('/api/projects/libre')).body.project).toEqual({ mine: true });
  });

  it('validates the game id and the body', async () => {
    const child = await signedIn();
    for (const id of ['Mayus', 'con_guion', 'a'.repeat(41), 'con.punto']) {
      const reply = await child.put(`/api/projects/${id}`, { project: {}, progress: PROGRESS });
      expect(reply.status).toBe(400);
      expect(reply.body.error.code).toBe('invalid_game_id');
    }
    expect((await child.get('/api/projects/Bad_Id')).status).toBe(400);
    expect((await child.put(`/api/projects/${'a'.repeat(40)}`, { project: {}, progress: PROGRESS })).status).toBe(200);

    const badBodies: unknown[] = [
      {},
      { progress: PROGRESS },
      { project: {} },
      { project: {}, progress: { ...PROGRESS, activeSeconds: -1 } },
      { project: {}, progress: { ...PROGRESS, finished: 'yes' } },
      { project: {}, progress: { ...PROGRESS, completedSteps: [{ id: 1 }] } },
    ];
    for (const body of badBodies) {
      const reply = await child.put('/api/projects/libre', body);
      expect(reply.status).toBe(400);
      expect(reply.body.error.code).toBe('invalid_request');
    }
    const malformed = await child.request('PUT', '/api/projects/libre', undefined, '{not json');
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe('invalid_json');
  });

  it('answers a clean 413 above 512 KB and accepts a large project below it', async () => {
    const child = await signedIn();
    const big = await child.put('/api/projects/libre', {
      project: { blob: 'x'.repeat(520 * 1024) },
      progress: PROGRESS,
    });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('payload_too_large');
    expect(JSON.stringify(big.body)).not.toContain('at ');

    const fine = await child.put('/api/projects/libre', {
      project: { blob: 'x'.repeat(400 * 1024) },
      progress: PROGRESS,
    });
    expect(fine.status).toBe(200);
  });
});

describe('http hygiene', () => {
  it('answers JSON 404 for unknown API routes and hides stack traces and the framework', async () => {
    const reply = await server.client().get('/api/nope');
    expect(reply.status).toBe(404);
    expect(reply.body).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
    expect(reply.headers.get('x-powered-by')).toBeNull();
    expect(reply.headers.get('x-content-type-options')).toBe('nosniff');
    expect(reply.headers.get('referrer-policy')).toBe('same-origin');
    expect((await server.client().request('POST', '/api/admin/nope', {})).status).toBe(401);
  });
});
