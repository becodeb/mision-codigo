# Misión Código

Plataforma para dar una clase de programación con bloques a chicos de 6 a 11 años. Cada chico entra con su nombre, ve los juegos del nivel que le asignaron los docentes y los arma paso a paso, con una guía que lo acompaña. Los docentes cargan la lista, asignan niveles y miran el progreso.

## Arranque rápido

Requisitos: Node 24 o superior (usa `node:sqlite` y ejecuta TypeScript directamente).

```bash
npm install
npm run build
NODE_ENV=production ADMIN_PASSWORD=<clave> SESSION_SECRET=<texto largo al azar> HOST=0.0.0.0 PORT=8300 node src/server/index.ts
```

Los chicos abren `http://<ip-de-la-máquina>:8300/`. Los docentes abren `/docente`.

Un solo proceso sirve la API y la aplicación compilada (`dist/`). Los datos quedan en un archivo SQLite dentro de `DATA_DIR`.

## Variables de entorno

| Variable | Obligatoria | Por defecto | Para qué sirve |
|----------|-------------|-------------|----------------|
| `NODE_ENV` | no | desarrollo | Con `production` el servidor se niega a arrancar sin `SESSION_SECRET` y `ADMIN_PASSWORD`. |
| `ADMIN_PASSWORD` | en producción | sin panel docente | Clave del panel docente. Sin ella el ingreso docente queda deshabilitado. |
| `SESSION_SECRET` | en producción | al azar en cada arranque | Firma las cookies de sesión. Si cambia, se cierran todas las sesiones. |
| `HOST` | no | `127.0.0.1` | Dirección donde escucha. Para la red del aula, usá `0.0.0.0` a propósito: no es el valor por defecto. |
| `PORT` | no | `8301` | Puerto. |
| `DATA_DIR` | no | `./data` | Carpeta de la base de datos. Está ignorada por git. |
| `COOKIE_SECURE` | no | `false` | Con `true`, las cookies solo viajan por HTTPS. |
| `TRUST_PROXY` | no | `false` | Con `true`, el límite de intentos de ingreso docente lee `X-Forwarded-For` (detrás de un proxy). |

## Cargar a los chicos

1. Entrá a `/docente` con `ADMIN_PASSWORD`.
2. En **Alumnos**, pegá la lista: una línea por chico, `Nombre, grupo, nivel`, separada por comas o tabulaciones. Una fila de encabezado `Nombre, grupo, nivel` se ignora. El nivel va de 1 a 5.
3. Si pegás un nombre que ya existe, se actualiza en lugar de duplicarse.
4. En **Clase activa**, elegí qué clase está en marcha. Los chicos ven los juegos de esa clase para su nivel, los que ya empezaron y el proyecto libre.

Guardá solo nombres de pila: cualquiera que llegue al servidor puede ver la lista de nombres. No hay código de acceso por decisión del taller; revisalo antes de publicar el servidor en internet.

## Niveles

| Nivel | Equipo | Bloques |
|-------|--------|---------|
| 1 | Equipo Sol | Imágenes: secuencia |
| 2 | Equipo Mar | Imágenes: eventos, tiempo, repetir, mensajes |
| 3 | Equipo Bosque | Texto: teclado, coordenadas, mensajes, contacto entre personajes |
| 4 | Equipo Volcán | Texto: por siempre, condicionales, ganar y perder |
| 5 | Equipo Galaxia | Texto: variables, azar, clones, listas |

Los chicos ven el nombre del equipo, nunca el número.

## Desarrollo

```bash
npm install
npm run start          # API en 127.0.0.1:8301 (reinicialo al cambiar el servidor)
npm run dev            # Vite con recarga; reenvía /api al puerto 8301
npm run seed           # carga nombres ficticios en cada nivel (no corre en producción)
```

Comprobaciones:

```bash
npm run typecheck
npm test               # Vitest con 2 procesos, pensado para una Raspberry Pi
npm run build          # typecheck y compilación en dist/
```

## Cómo está armado

| Carpeta | Contenido |
|---------|-----------|
| `src/language/` | Lenguaje de bloques: representación intermedia, definiciones de Blockly, cajas de herramientas |
| `src/runtime/` | Máquina que ejecuta los programas, sin DOM; la misma corre en las pruebas |
| `src/games/` | Un archivo por juego: guía, pasos, retos y una solución que se juega en las pruebas |
| `src/studio/` | Editor: escenario, bloques, guía, modo pantalla grande |
| `src/workshop/` | Pantalla de nombres y lista de juegos |
| `src/teacher/` | Panel docente |
| `src/server/` | Express, SQLite y rutas |
| `src/art/`, `src/audio/` | Personajes, objetos, escenarios, sonidos y voz |
| `public/niveles/` | Página anterior de niveles, servida tal cual en `/niveles/` |

Un juego solo se publica si su prueba carga la solución, la juega con entradas simuladas y comprueba que todos los pasos se cumplen y que el juego llega a su final.

## Puntos a tener en cuenta

- La aplicación no necesita internet: Blockly y las tipografías van incluidas.
- La voz de la guía usa las voces del navegador. En los niveles 1 y 2 lee cada paso sola; en los niveles 3 a 5 solo cuando se aprieta «Escuchar».
- El proyecto de cada chico se guarda en el servidor y también en el navegador, para que un corte de red no pierda trabajo.
- No hay Dockerfile todavía.
