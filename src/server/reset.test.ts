import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MIGRATIONS, createStore, migrate, openDatabase } from './db.ts';
import { PROGRESS, addStudent, loginAdmin, startTestServer } from './test-helpers.ts';
import type { Client, TestServer } from './test-helpers.ts';

describe('migration 2 (resets)', () => {
  it('runs over a database that only has version 1 and keeps its data', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('CREATE TABLE schema_version (version INTEGER NOT NULL)');
    db.exec(MIGRATIONS[0]);
    db.exec('INSERT INTO schema_version (version) VALUES (1)');
    db.exec("INSERT INTO students (name, group_name, level, created_at) VALUES ('Luna', '3° A', 4, 't')");
    db.exec("INSERT INTO projects VALUES (1, 'libre', '{\"a\":1}', '{}', 't')");

    migrate(db);
    migrate(db); // a second start does nothing

    expect(db.prepare('SELECT MAX(version) AS v FROM schema_version').get()).toEqual({ v: 2 });
    expect(db.prepare('SELECT project FROM projects').get()).toEqual({ project: '{"a":1}' });
    const store = createStore(db);
    expect(store.epochOf(1, 'libre')).toBe(0); // no row means epoch 0: copies from before the deploy stay valid
    expect(store.saveProject(1, 'libre', 0, '{"a":2}', '{}')).not.toBeNull();
    store.resetGame(1, 'libre');
    expect(store.epochOf(1, 'libre')).toBe(1);
    db.exec('DELETE FROM students WHERE id = 1');
    expect(db.prepare('SELECT COUNT(*) AS n FROM resets').get()).toEqual({ n: 0 }); // the counters go with the student
  });
});

describe('store: save against the counter', () => {
  it('writes nothing for a stale epoch and accepts the current one, checked together', () => {
    const db = openDatabase(':memory:');
    const store = createStore(db);
    const id = store.createStudent({ name: 'Luna', group: '', level: 1 }).id;
    expect(store.saveProject(id, 'libre', 0, '{"v":1}', '{}')).not.toBeNull();
    expect(store.resetGame(id, 'libre')).toBe(true);
    expect(store.saveProject(id, 'libre', 0, '{"v":2}', '{}')).toBeNull();
    expect(store.getProject(id, 'libre')).toBeNull();
    expect(store.saveProject(id, 'libre', 1, '{"v":3}', '{}')).not.toBeNull();
    expect(JSON.parse(store.getProject(id, 'libre')?.project ?? '')).toEqual({ v: 3 });
  });

  it('a game counter and the all-games counter add up, so each reset only ever makes the number grow', () => {
    const store = createStore(openDatabase(':memory:'));
    const id = store.createStudent({ name: 'Luna', group: '', level: 1 }).id;
    store.resetGame(id, 'libre');
    store.resetStudent(id);
    store.resetGame(id, 'libre');
    expect(store.epochOf(id, 'libre')).toBe(3);
    expect(store.epochOf(id, 'tesoro')).toBe(1);
  });
});

let server: TestServer;
let admin: Client;
let luna: number;
let mateo: number;
let lunaClient: Client;
let mateoClient: Client;

async function enter(id: number): Promise<Client> {
  const child = server.client();
  await child.post('/api/session', { studentId: id });
  return child;
}
const put = (child: Client, game: string, extra: Record<string, unknown> = {}, project: unknown = { v: 1 }) =>
  child.put(`/api/projects/${game}`, { project, progress: PROGRESS, ...extra });

beforeEach(async () => {
  server = await startTestServer();
  admin = server.client();
  await loginAdmin(admin);
  luna = await addStudent(admin, 'Luna');
  mateo = await addStudent(admin, 'Mateo');
  lunaClient = await enter(luna);
  mateoClient = await enter(mateo);
});
afterEach(() => server.close());

describe('reset one game', () => {
  it('deletes only that game of that child and reports the new counter, also when there is no project', async () => {
    await put(lunaClient, 'libre');
    await put(lunaClient, 'caza-pulpi');
    await put(mateoClient, 'libre');

    expect((await admin.del(`/api/admin/students/${luna}/projects/libre`)).status).toBe(200);

    const gone = await lunaClient.get('/api/projects/libre');
    expect(gone.status).toBe(404);
    expect(gone.body).toMatchObject({ error: { code: 'project_not_found' }, epoch: 1 });
    expect((await lunaClient.get('/api/projects/caza-pulpi')).body).toMatchObject({ epoch: 0, project: { v: 1 } });
    expect((await mateoClient.get('/api/projects/libre')).body).toMatchObject({ epoch: 0, project: { v: 1 } });

    expect((await admin.del(`/api/admin/students/${luna}/projects/tesoro`)).status).toBe(200);
    expect((await lunaClient.get('/api/projects/tesoro')).body.epoch).toBe(1);
  });

  it('needs the teacher, an existing student and a real game', async () => {
    expect((await lunaClient.del(`/api/admin/students/${luna}/projects/libre`)).status).toBe(401);
    expect((await server.client().del(`/api/admin/students/${luna}/projects/libre`)).status).toBe(401);
    expect((await admin.del('/api/admin/students/9999/projects/libre')).status).toBe(404);
    expect((await admin.del(`/api/admin/students/${luna}/projects/no-existe`)).status).toBe(404);
    expect((await admin.del(`/api/admin/students/${luna}/projects/Bad_Id`)).status).toBe(400);
  });
});

describe('reset all games of a child', () => {
  it('deletes every saved game, counts them, and keeps the student, the others and the level', async () => {
    await put(lunaClient, 'libre');
    await put(lunaClient, 'caza-pulpi');
    await put(mateoClient, 'libre');
    expect((await admin.get('/api/admin/students')).body.students.map((s: { savedGames: number }) => s.savedGames)).toEqual([2, 1]);

    const reply = await admin.del(`/api/admin/students/${luna}/projects`);
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({ ok: true, removed: 2 });

    expect((await lunaClient.get('/api/projects')).body.projects).toEqual([]);
    expect((await mateoClient.get('/api/projects/libre')).body).toMatchObject({ project: { v: 1 }, epoch: 0 });
    const students = (await admin.get('/api/admin/students')).body.students;
    expect(students.find((s: { id: number }) => s.id === luna)).toMatchObject({ name: 'Luna', level: 3, savedGames: 0 });
    expect((await admin.del(`/api/admin/students/${luna}/projects`)).body.removed).toBe(0); // still succeeds
  });

  it('refuses the old copy of every game, also of games that were never saved on the server', async () => {
    await put(lunaClient, 'libre');
    await admin.del(`/api/admin/students/${luna}/projects`);
    for (const game of ['libre', 'caza-pulpi', 'tesoro']) {
      expect((await lunaClient.get(`/api/projects/${game}`)).body.epoch).toBe(1);
      const stale = await put(lunaClient, game, { epoch: 0 });
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe('progress_reset');
    }
    expect((await lunaClient.get('/api/projects')).body.projects).toEqual([]);
    expect((await put(mateoClient, 'tesoro', { epoch: 0 })).status).toBe(200);
  });

  it('needs the teacher and an existing student', async () => {
    expect((await lunaClient.del(`/api/admin/students/${luna}/projects`)).status).toBe(401);
    expect((await server.client().del(`/api/admin/students/${luna}/projects`)).status).toBe(401);
    expect((await admin.del('/api/admin/students/9999/projects')).status).toBe(404);
    expect((await admin.del('/api/admin/students/abc/projects')).status).toBe(400);
  });
});

describe('saving against the counter', () => {
  it('refuses a copy from before the reset, writes nothing, and accepts the new counter', async () => {
    await put(lunaClient, 'libre', { epoch: 0 }, { v: 'old' });
    await admin.del(`/api/admin/students/${luna}/projects/libre`);

    const stale = await put(lunaClient, 'libre', { epoch: 0 }, { v: 'late save' });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('progress_reset');
    expect((await lunaClient.get('/api/projects/libre')).status).toBe(404);
    expect(server.db.prepare('SELECT COUNT(*) AS n FROM projects').get()).toEqual({ n: 0 });

    expect((await put(lunaClient, 'libre', { epoch: 1 }, { v: 'new' })).status).toBe(200);
    expect((await lunaClient.get('/api/projects/libre')).body).toMatchObject({ project: { v: 'new' }, epoch: 1 });
  });

  it('a page from before resets existed (no counter) is accepted until the first reset, then refused', async () => {
    expect((await put(lunaClient, 'libre')).status).toBe(200);
    expect((await put(lunaClient, 'libre', {}, { v: 2 })).status).toBe(200);
    await admin.del(`/api/admin/students/${luna}/projects/libre`);
    const late = await put(lunaClient, 'libre', {}, { v: 'late' });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('progress_reset');
    expect((await lunaClient.get('/api/projects/libre')).status).toBe(404);
    // Another game of the same child was not reset.
    expect((await put(lunaClient, 'caza-pulpi')).status).toBe(200);
  });

  it('rejects a malformed counter', async () => {
    for (const epoch of [-1, 1.5, '1', null]) expect((await put(lunaClient, 'libre', { epoch })).status).toBe(400);
  });
});
