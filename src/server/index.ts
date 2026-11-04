import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import type { AppConfig } from './config.ts';
import { openDatabase } from './db.ts';

let config: AppConfig;
try {
  config = loadConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const distDir = resolve(import.meta.dirname, '../../dist');
if (existsSync(join(distDir, 'index.html'))) config.staticDir = distDir;

const db = openDatabase(join(config.dataDir, 'mision-codigo.sqlite'));
const app = createApp({ db, config });

const server = app.listen(config.port, config.host, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  console.log(
    `Misión Código listening on http://${config.host}:${port} (${config.staticDir ? 'serving dist/' : 'API only'})`,
  );
});

function shutdown(): void {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
