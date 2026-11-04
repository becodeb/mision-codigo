// Development only: loads fictional first names at every level.
import { join } from 'node:path';
import { loadConfig } from './config.ts';
import { openDatabase, createStore } from './db.ts';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed in production.');
  process.exit(1);
}

const NAMES: Record<string, string[]> = {
  '1': ['Luna', 'Mateo', 'Sofía', 'Thiago'],
  '2': ['Valentín', 'Emma', 'Bruno', 'Olivia'],
  '3': ['Joaquín', 'Martina', 'Lautaro', 'Isabella'],
  '4': ['Benicio', 'Catalina', 'Santino', 'Delfina'],
  '5': ['Felipe', 'Renata', 'Ignacio', 'Julieta'],
};

const config = loadConfig(process.env, () => {});
const db = openDatabase(join(config.dataDir, 'mision-codigo.sqlite'));
const store = createStore(db);
const rows = Object.entries(NAMES).flatMap(([level, names]) =>
  names.map((name) => ({ name, group: 'Demo', level: Number(level) as 1 | 2 | 3 | 4 | 5 })),
);
const { created, updated } = store.upsertStudents(rows);
console.log(`Seeded ${created} new and ${updated} existing students into ${config.dataDir}.`);
db.close();
