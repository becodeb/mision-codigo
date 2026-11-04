# Estudio por niveles

## Objective

Turn Misión Código into the platform for the workshop's family showcase: each child enters by
name, sees the games of the difficulty level the teachers assigned, and builds one with a parent.

## Problem and why

Today the Estudio is one 1,581-line HTML file with two fixed modes, one project per browser, and a
block set that blocks whole game genres (no variables, comparisons, else, random numbers, clones,
objects). Children from 1st to 5th grade differ more by experience than by grade, so the grade
cannot select the content. The owner's rule: **logic must be the limit, not the blocks**.

## Scope

In scope: rewrite on React + Vite + TypeScript, Express backend with SQLite, new block language and
headless runtime, 23 guided games plus a free project, 5 levels, teacher panel, LAN serving,
Docker-ready production build.

Out of scope for now: public deploy, accounts or passwords for children, sharing projects between
children, `niveles/` rewrite (kept as is, served as a static legacy page).

## Constraints

- Authorized by the owner on 2026-11-04: free to add, modify and migrate; backend with Express.
- UI copy in Spanish (the project's language, voseo as in the current app). Code, identifiers and
  comments in English.
- Must not recreate a specific existing game: genres are fine, names/characters/art are ours.
- No internet needed during class: Blockly and fonts are bundled, not loaded from a CDN.
- Raspberry Pi: `vitest --maxWorkers=2`, at most one writer at a time on this tree.
- Never bind the server to `0.0.0.0` by default. `HOST` is explicit.
- Children's names are personal data: never readable without the workshop code.
- No push, PR or merge without the owner asking. The remote belongs to another GitHub account.

## Workflow settings

- TDD: **off**. Source: no project configuration exists. Runner: Vitest (introduced in T01). Ordinary
  functional checks run for every task.
- RDD: off (global, `gentle-ai review mode status`). No native review.
- Delivery: `exception-ok`. Reason: greenfield rewrite on one local branch, no PR requested, and
  the slices cannot be reviewed apart from the rewrite they replace. Forecast: well over 400 lines.
- Route: delegated direct, one writer at a time (writer trigger: 2+ non-trivial files per task).

## Design

### Levels

The level is a property of the child, set by teachers. It is defined by the logic a game needs.

| Level | Internal id | Child-facing name | Logic | Block tier |
|---|---|---|---|---|
| 1 | 1 | Equipo Sol | Sequence | picture |
| 2 | 2 | Equipo Mar | Events, timing, repeat, several sprites | picture |
| 3 | 3 | Equipo Bosque | Keyboard, coordinates, messages; no conditionals | text |
| 4 | 4 | Equipo Volcán | Loop + rules: forever, if touching, points, win/lose | text |
| 5 | 5 | Equipo Galaxia | State: variables, comparison, else, random, clones, lists | text |

Children see the team name and never a number, so a 5th grader in Level 1 is not labeled in front of
their family. Teachers see both. A child sees the games of their level plus a free project.

### Language

One intermediate representation (IR) is the source of truth: `Block { type, fields, inputs, body,
elseBody }`. Blockly state converts to IR to run, and IR converts to Blockly state so games can
declare starters and solutions as data. Toolboxes are per level and per game. `Modo libre` shows
everything the level allows.

**Picture tier** (levels 1 and 2). Existing `f_*` blocks plus: `f_hide`, `f_show`, `f_note` (do, re,
mi, fa, sol, la, si), `f_random` (appear anywhere).

**Text tier** (levels 3 to 5). Inputs are value sockets with shadow blocks, as in Scratch.

| Group | Level 3 | Level 4 adds | Level 5 adds |
|---|---|---|---|
| Events | flag, tap, key, send, receive | when touching X (edge-triggered) | when I start as a clone |
| Motion | move, point dir, change x/y, go to x/y, go to random, glide, jump | move with arrows (speed), bounce on edge, go to sprite | turn, point angle, point towards sprite, set x/y |
| Looks | say, say for, think for, face, size, show, hide, backdrop | | |
| Sound | sound, note | | |
| Control | wait, repeat | forever, if, stop all, win, lose | if/else, repeat until, wait until, stop this script, create clone, delete clone |
| Values | number, text | points (set, add, read), touching X, key pressed | variables, lists, random a..b, + - × ÷, = < >, and/or/not, join, x, y, timer, distance to X, ask + answer |

Variables and lists are project-wide, created from a modal, and shown as monitors on the stage.

Semantics follow Scratch: compare numerically when both sides are numeric, otherwise as
case-insensitive text. Clones are capped at 30. Repeat counts are capped at 500.

### Runtime

Pure TypeScript with no DOM: an injectable clock and frame scheduler, sprite instances (clones
included), threads per script, an event bus, input state, and a stats recorder for guide checks.
A thin adapter renders to SVG and plays audio. The same runtime runs headless under Vitest.

Fixes owed from the old engine:

- Touching and bouncing must detect the bottom edge (old `clampXY` made it unreachable).
- Jumping must move the hitbox, not only the drawing (old `sprBounds` ignored `jy`).
- `bounce` must work for any angle.

### Art

Keep the six characters, six backdrops, Robi, SFX and speech. Add objects without faces: star, coin,
apple, ball, car, rock, treasure, heart, paddle, bolt, cloud, bomb. Objects ignore the face block.

### Games

A game is data, in `src/games/`: `id`, `level`, `kind` (`story` or `game`), `title`, `pitch`,
`concept`, `familyTip` (what the adult does and what the child does), `setup` (backdrop, sprites,
starter code), `toolbox`, `steps[]` (title, spoken text, unlocks, demo or example, `check(ctx)`),
`challenge` (an optional extra), and `solution` (per-sprite IR plus a scripted input scenario).

**Every game must prove it can be built**: a Vitest test loads the solution into the headless
runtime, plays the scenario, and asserts that every step check passes and the win or end state
happens. A game without a passing proof does not ship.

Catalog (`H` story, `J` game):

| L | Id | Title | Kind | What it is |
|---|---|---|---|---|
| 1 | `hola-somos` | Hola, somos nosotros | H | Child and adult pick a character each; tapping one introduces it |
| 1 | `paseo-toby` | El paseo de Toby | H | Toby crosses the park walking and jumping |
| 1 | `baile-pulpi` | El baile de Pulpi | H | A dance with spins, jumps and sounds |
| 1 | `mi-mascota` | Mi mascota | J | Tap it: it laughs, sounds and jumps |
| 2 | `banda-parque` | La banda del parque | J | Each character plays notes when tapped |
| 2 | `chiste-robi` | El chiste de Robi | H | One tells the joke, the other waits and laughs |
| 2 | `la-carrera` | La carrera | J | Two racers; the blocks decide who wins |
| 2 | `escondidas` | Las escondidas | J | Tapping one reveals another |
| 3 | `preguntale` | Preguntale a tu familia | J | The child writes questions about themself; the adult taps the answer |
| 3 | `caza-pulpi` | Cazá a Pulpi | J | Tap it: a point, and it jumps elsewhere |
| 3 | `dos-finales` | Cuento con dos finales | H | Pick an option: the scene and the ending change |
| 3 | `maneja-nova` | Manejá a Nova | J | Fly through space with the arrows to reach the planet |
| 4 | `tesoro` | Búsqueda del tesoro | J | Reach the treasure: a point, and it appears elsewhere |
| 4 | `chispa` | Que no te atrape Chispa | J | Dodge Chispa; if she touches you, you lose |
| 4 | `cruza-ciudad` | Cruzá la ciudad | J | Reach the top without being hit by cars |
| 4 | `salto` | Salto de obstáculos | J | Jump what comes from the right |
| 4 | `ataja` | Atajá lo que cae | J | Catch falling objects |
| 5 | `tres-vidas` | Tres vidas | J | Catch stars, avoid bombs; at zero lives the game ends |
| 5 | `contrarreloj` | Contrarreloj | J | 10 points before 30 seconds |
| 5 | `mascota-virtual` | Mascota virtual | J | Hunger and energy fall by themselves; keep it alive |
| 5 | `rebote` | Rebote | J | Paddle and ball with angles |
| 5 | `defensa` | Defensa del castillo | J | Shoot clones of what approaches |
| 5 | `memoria` | Memoria de sonidos | J | Repeat a growing sequence; the hardest |

### Backend

Express 5 on Node 24 with `node:sqlite`, running TypeScript directly through native type stripping.
Production serves the built client from the same process.

Access model:

- `WORKSHOP_CODE`: shared code written on the board. Required to read the name list.
- Children pick their name by tapping (first graders cannot type it). No child password: the threat
  is a classmate opening a project, which is acceptable in a supervised class.
- `ADMIN_PASSWORD`: teacher panel. Constant-time comparison and login rate limit.
- Signed, httpOnly, `SameSite=Strict` cookies signed with `SESSION_SECRET`. The server refuses to
  start in production when a secret is missing.

API:

- `POST /api/session { code }`, `GET /api/session`, `DELETE /api/session`
- `GET /api/students`, `POST /api/session/student { id }`
- `GET /api/projects`, `GET /api/projects/:gameId`, `PUT /api/projects/:gameId`
- `POST /api/admin/session`, `DELETE /api/admin/session`
- `GET|POST /api/admin/students`, `PATCH|DELETE /api/admin/students/:id`,
  `POST /api/admin/students/import`, `GET /api/admin/progress`,
  `DELETE /api/admin/students/:id/projects/:gameId`

Projects are opaque JSON, capped at 512 KB. The client autosaves with a debounce and keeps a
localStorage copy, so a backend failure never loses a child's work and shows a visible notice.

### Structure

```text
src/
  language/   IR, block definitions, toolboxes, Blockly <-> IR
  runtime/    headless machine, clock, instances, expressions
  art/        characters, objects, backdrops
  audio/      SFX and speech
  games/      catalog, one file per level, proofs
  studio/     React editor: stage, workspace, guide, show mode, hand demo
  workshop/   code, name picker, level game chooser
  teacher/    panel
  shared/     levels and API types
  server/     Express app, SQLite, routes
```

## Tasks

- [ ] **T01 Foundation and runtime.** Vite + React + TS + Vitest. Bundled Blockly and fonts. IR,
      headless runtime with the full language and the three fixes, ported art and audio, objects.
      Route: delegated. Checks: typecheck, Vitest, build.
- [ ] **T02 Blocks.** Block definitions for both tiers, per-level toolboxes, Blockly <-> IR round
      trip for every block type. Route: delegated. Checks: typecheck, Vitest.
- [ ] **T03 Studio.** React editor at parity with the old app (stage, drag, workspace per sprite,
      guide with voice, Mostrame hand, show mode, confetti) plus monitors, win/lose overlay, ask
      modal, variable modal, touch arrows. Route: delegated. Checks: typecheck, Vitest, build,
      browser capture.
- [ ] **T04 Backend.** Express, SQLite, sessions, all routes, tests. Route: delegated. Checks:
      typecheck, Vitest, real HTTP run.
- [ ] **T05 Workshop flow.** Code, name picker, level chooser, autosave with offline fallback.
      Route: delegated. Checks: typecheck, Vitest, build, browser capture.
- [ ] **T06 Levels 1 and 2 catalog.** 8 games with guides and proofs. Route: delegated. Checks:
      Vitest proofs, browser capture of one game from each level.
- [ ] **T07 Levels 3 and 4 catalog.** 9 games with guides and proofs. Route: delegated. Checks: same.
- [ ] **T08 Level 5 catalog.** 6 games with guides and proofs. Route: delegated. Checks: same.
- [ ] **T09 Teacher panel.** Login, bulk import, level assignment, progress. Route: delegated.
      Checks: typecheck, Vitest, build, browser capture.
- [ ] **T10 Close.** Real browser pass through the whole flow, Dockerfile, README, remove the old
      `estudio/`, move `niveles/` to static serving, serve on the LAN. Route: delegated, then parent
      spot check. Checks: e2e against the production build.

## Acceptance criteria

- A child enters the code, taps their name and sees only their level's games plus the free project.
- Each of the 23 games has a guide and a passing headless proof.
- Closing the browser and logging in from another computer restores the child's project.
- A teacher can paste a class list, assign levels and see progress.
- The app works with the backend reachable and no internet access.
- `typecheck`, Vitest and the production build all pass.

## Progress

Exploration done. Branch `feat/estudio-por-niveles` created from `main` at `ce5eec0`.

## Verification evidence

None yet.

## Next step

T01.
