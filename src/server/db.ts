import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ClassId, LevelId } from '../shared/levels.ts';

// Each entry is one schema version. Append new entries; never edit old ones.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE,
    group_name TEXT NOT NULL COLLATE NOCASE DEFAULT '',
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
    created_at TEXT NOT NULL,
    UNIQUE (name, group_name)
  );
  CREATE TABLE projects (
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    game_id TEXT NOT NULL,
    project TEXT NOT NULL,
    progress TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (student_id, game_id)
  );
  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  INSERT INTO settings (key, value) VALUES ('activeClass', '1');
  `,
];

export function migrate(db: DatabaseSync): void {
  db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_version').get() as {
    version: number | null;
  };
  for (let index = row.version ?? 0; index < MIGRATIONS.length; index++) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[index]);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(index + 1);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

/** Opens (and migrates) the database. Use ':memory:' for tests. */
export function openDatabase(file: string): DatabaseSync {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  return db;
}

export interface StudentRow {
  id: number;
  name: string;
  group: string;
  level: LevelId;
  createdAt: string;
}

interface StudentDb {
  id: number;
  name: string;
  group_name: string;
  level: number;
  created_at: string;
}

function toStudent(row: StudentDb): StudentRow {
  return {
    id: row.id,
    name: row.name,
    group: row.group_name,
    level: row.level as LevelId,
    createdAt: row.created_at,
  };
}

export interface ProjectMeta {
  gameId: string;
  progress: string;
  updatedAt: string;
}

export interface ProgressRow {
  student: StudentRow;
  gameId: string;
  progress: string;
  updatedAt: string;
}

export interface RosterUpsert {
  name: string;
  group: string;
  level: LevelId;
}

export type Store = ReturnType<typeof createStore>;

export function createStore(db: DatabaseSync, now: () => number = Date.now) {
  const iso = () => new Date(now()).toISOString();

  function transaction<T>(fn: () => T): T {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  function findStudent(name: string, group: string): StudentRow | null {
    const row = db
      .prepare('SELECT * FROM students WHERE name = ? AND group_name = ?')
      .get(name, group) as unknown as StudentDb | undefined;
    return row ? toStudent(row) : null;
  }

  function createStudent(input: RosterUpsert): StudentRow {
    const result = db
      .prepare('INSERT INTO students (name, group_name, level, created_at) VALUES (?, ?, ?, ?)')
      .run(input.name, input.group, input.level, iso());
    return getStudent(Number(result.lastInsertRowid)) as StudentRow;
  }

  function getStudent(id: number): StudentRow | null {
    const row = db.prepare('SELECT * FROM students WHERE id = ?').get(id) as unknown as
      | StudentDb
      | undefined;
    return row ? toStudent(row) : null;
  }

  return {
    transaction,
    findStudent,
    createStudent,
    getStudent,

    listStudents(): StudentRow[] {
      const rows = db
        .prepare('SELECT * FROM students ORDER BY name COLLATE NOCASE, group_name COLLATE NOCASE, id')
        .all() as unknown as StudentDb[];
      return rows.map(toStudent);
    },

    updateStudent(id: number, patch: Partial<RosterUpsert>): StudentRow | null {
      const current = getStudent(id);
      if (!current) return null;
      db.prepare('UPDATE students SET name = ?, group_name = ?, level = ? WHERE id = ?').run(
        patch.name ?? current.name,
        patch.group ?? current.group,
        patch.level ?? current.level,
        id,
      );
      return getStudent(id);
    },

    deleteStudent(id: number): boolean {
      return Number(db.prepare('DELETE FROM students WHERE id = ?').run(id).changes) > 0;
    },

    /** Inserts or updates by name + group, all or nothing. */
    upsertStudents(rows: RosterUpsert[]): { created: number; updated: number } {
      return transaction(() => {
        let created = 0;
        let updated = 0;
        for (const row of rows) {
          const existing = findStudent(row.name, row.group);
          if (existing) {
            db.prepare('UPDATE students SET level = ? WHERE id = ?').run(row.level, existing.id);
            updated++;
          } else {
            createStudent(row);
            created++;
          }
        }
        return { created, updated };
      });
    },

    getActiveClass(): ClassId {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'activeClass'").get() as
        | { value: string }
        | undefined;
      return row?.value === '2' ? 2 : 1;
    },

    setActiveClass(value: ClassId): void {
      db.prepare(
        "INSERT INTO settings (key, value) VALUES ('activeClass', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      ).run(String(value));
    },

    listProjects(studentId: number): ProjectMeta[] {
      const rows = db
        .prepare(
          'SELECT game_id, progress, updated_at FROM projects WHERE student_id = ? ORDER BY updated_at DESC, game_id',
        )
        .all(studentId) as unknown as { game_id: string; progress: string; updated_at: string }[];
      return rows.map((r) => ({ gameId: r.game_id, progress: r.progress, updatedAt: r.updated_at }));
    },

    getProject(studentId: number, gameId: string) {
      const row = db
        .prepare('SELECT project, progress, updated_at FROM projects WHERE student_id = ? AND game_id = ?')
        .get(studentId, gameId) as unknown as
        | { project: string; progress: string; updated_at: string }
        | undefined;
      return row ? { project: row.project, progress: row.progress, updatedAt: row.updated_at } : null;
    },

    saveProject(studentId: number, gameId: string, projectJson: string, progressJson: string): string {
      const updatedAt = iso();
      db.prepare(
        `INSERT INTO projects (student_id, game_id, project, progress, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (student_id, game_id) DO UPDATE SET
           project = excluded.project, progress = excluded.progress, updated_at = excluded.updated_at`,
      ).run(studentId, gameId, projectJson, progressJson, updatedAt);
      return updatedAt;
    },

    deleteProject(studentId: number, gameId: string): boolean {
      return (
        Number(
          db.prepare('DELETE FROM projects WHERE student_id = ? AND game_id = ?').run(studentId, gameId).changes,
        ) > 0
      );
    },

    /** Every project without its heavy JSON, joined with its student. */
    listProgressRows(): ProgressRow[] {
      const rows = db
        .prepare(
          `SELECT s.id, s.name, s.group_name, s.level, s.created_at, p.game_id, p.progress, p.updated_at AS project_updated_at
           FROM projects p JOIN students s ON s.id = p.student_id
           ORDER BY s.name COLLATE NOCASE, s.id, p.game_id`,
        )
        .all() as unknown as (StudentDb & {
        game_id: string;
        progress: string;
        project_updated_at: string;
      })[];
      return rows.map((r) => ({
        student: toStudent(r),
        gameId: r.game_id,
        progress: r.progress,
        updatedAt: r.project_updated_at,
      }));
    },
  };
}
