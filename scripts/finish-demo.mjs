// Deja dist-demo/ listo para Cloudflare Pages: la página como index.html y sin indexar en buscadores.
import { renameSync, writeFileSync } from 'node:fs';
renameSync('dist-demo/demo.html', 'dist-demo/index.html');
writeFileSync('dist-demo/_headers', '/*\n  X-Robots-Tag: noindex, nofollow\n');
