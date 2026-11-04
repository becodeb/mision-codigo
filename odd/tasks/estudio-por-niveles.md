# Estudio por niveles

## Objective

Turn Misión Código into the platform for the workshop's showcase class: each child enters by name,
sees the games of the difficulty level the teachers assigned, and builds them during a class of
30 to 60 minutes without running out of things to do. It is a normal class: parents accompany and
help, but no game is about them or gives them a role.

## Problem and why

Today the Estudio is one 1,581-line HTML file with two fixed modes, one project per browser, and a
block set that blocks whole game genres (no variables, comparisons, else, random numbers, clones,
objects). Children from 1st to 5th grade differ more by experience than by grade, so the grade
cannot select the content. The owner's rule: **logic must be the limit, not the blocks**.

## Scope

In scope: rewrite on React + Vite + TypeScript, Express backend with SQLite, new block language and
headless runtime, 23 guided games plus a free project, 5 levels, teacher panel, LAN serving,
Docker-ready production build.

Out of scope for now: public deploy, accounts or passwords for children, `niveles/` rewrite (kept as
is, served as a static legacy page).

## Constraints

- Authorized by the owner on 2026-11-04: free to add, modify and migrate; backend with Express.
- UI copy in Spanish (the project's language, voseo as in the current app). Code, identifiers and
  comments in English.
- Must not recreate a specific existing game: genres are fine, names/characters/art are ours.
- No internet needed during class: Blockly and fonts are bundled, not loaded from a CDN.
- Raspberry Pi: `vitest --maxWorkers=2`, at most one writer at a time on this tree.
- Never bind the server to `0.0.0.0` by default. `HOST` is explicit.
- There is one workshop and no access code, by the owner's decision (2026-11-04). Anyone who reaches
  the server can read the name list, so store first names only, and revisit this before any public
  deploy.
- No push, PR or merge without the owner asking. The remote belongs to another GitHub account.

## Schedule

Class 1 is on 2026-11-04 at 16:45 Argentina time (19:45 UTC; the machine clock is UTC). The build must
be frozen by 15:45 Argentina time (18:45 UTC), leaving an hour to load names and test.

If time runs short, cut in this order: the third level 5 game, then the teacher panel's progress view
(the data is still recorded), then the second game of a level. The fallback is the old app.

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
mi, fa, sol, la, si), `f_random` (appear anywhere), `f_backdrop` (change scene, so stories have
chapters), `f_star` (+1 star on the stage), `f_send` and `f_recv` (colored envelopes: red, blue,
yellow).

**Text tier** (levels 3 to 5). Inputs are value sockets with shadow blocks, as in Scratch.

| Group | Level 3 | Level 4 adds | Level 5 adds |
|---|---|---|---|
| Events | flag, tap, key, send, receive, when points reach N (fires once per run) | when touching X (edge-triggered) | when I start as a clone |
| Motion | move, point dir, change x/y, go to x/y, go to random, glide, jump | move with arrows (speed), bounce on edge, go to sprite | turn, point angle, point towards sprite, set x/y |
| Looks | say, say for, think for, face, size, show, hide, backdrop | | |
| Sound | sound, note | | |
| Control | wait, repeat, win | forever, if, stop all, stop my other scripts, lose | if/else, repeat until, wait until, stop this script, create clone, delete clone |
| Values | number, text, points (set, add) | points (read), touching X, key pressed | variables, lists, random a..b, + - × ÷, = < >, and/or/not, join, x, y, timer, distance to X, ask + answer |

Variables and lists are project-wide, created from a modal, and shown as monitors on the stage.

Messages include `fase 2`, `fase 3`, `fase 4`, `final A`, `final B`. With «when points reach N»,
those messages and «stop my other scripts», a child can program phases without variables.

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
`concept`, `setup` (backdrop, sprites, starter code), `toolbox`, `phases[]`, `challenges[]`, and
`solution` (per-sprite IR plus a scripted input scenario). A phase has a title and `steps[]`. A step
has a title, spoken text, unlocks, `hints[]`, and `check(ctx)`.

**Every game must prove it can be built**: a Vitest test loads the solution into the headless
runtime, plays the scenario, and asserts that every step check passes and the win or end state
happens. A game without a passing proof does not ship.

### Class length

A class lasts 30 to 60 minutes and no child should run out of things to do. A team therefore has
much more content than one class needs, and every game grows instead of ending after one idea.

- **Phases.** Each game has at least 3 phases. The same project grows through them: a story gains
  chapters, a game gains harder rounds.
- **Minimum steps per game.** Levels 1 and 2: 8 and 10. Levels 3, 4 and 5: 10, 12 and 12. A Vitest
  test enforces these minimums across the catalog.
- **Thinking, not copying.** The first phase teaches with demos. Later steps state the goal and
  keep the answer behind a hint ladder: goal, then a hint, then an example. A child who only follows
  instructions must not be able to finish a phase by dragging what is on screen.
- **Challenges.** Each game ends with at least 3 open challenges with no single answer, so a fast
  child keeps building inside the same game.
- **No dead end.** Finishing a game offers the next one of the level, ordered from easier to harder.
  The free project is always available.
- **Target.** One game takes a typical child of that level 25 to 40 minutes. This is an estimate
  that only a real class can confirm.

### Catalog

`H` story, `J` game. Phases are cumulative.

| L | Id | Title | Kind | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|---|---|---|
| 1 | `presentacion` | La gran presentación | H | The hero appears and introduces itself | A friend appears and they talk | They travel to another place | They say goodbye with faces and sounds |
| 1 | `paseo-toby` | El paseo de Toby | H | Cross the park walking and jumping | Arrive at the castle and meet someone | Something scary happens | Back home with a happy ending |
| 1 | `baile-pulpi` | El baile de Pulpi | H | Invent the first steps | Add a dance partner | Each dancer gets a solo | Grand finale at the theater with applause |
| 1 | `mi-mascota` | Mi mascota | J | Tap it and it reacts | It eats and grows | A second pet with its own reactions | The pets play together in another place |
| 2 | `banda-parque` | La banda del parque | J | One musician plays a melody when tapped | Three musicians, each with its own notes | Repeat a chorus with «repetir» | A conductor starts everyone with envelopes |
| 2 | `chiste-robi` | El show de chistes | H | One tells a joke, the other waits and laughs | Take turns with envelopes | A second joke in a new scene | The audience reacts and the show closes |
| 2 | `la-carrera` | La carrera | J | Two racers with «repetir» | The blocks decide who wins | A second lap with jumps | Stars for the winner and a podium scene |
| 2 | `escondidas` | Las escondidas | J | Tapping one reveals another | Everyone hides and appears in random places | A star for each one found | The final hiding place opens a new scene |
| 3 | `quiz` | El gran quiz | J | A question with answers you tap | Right gives a point, wrong gives a message | Three questions linked by messages | A final screen that depends on the points |
| 3 | `caza-pulpi` | Cazá a Pulpi | J | Tap it: a point, and it jumps elsewhere | It moves by itself | At 5 points: a new backdrop and a second target | At 10 points: win |
| 3 | `dos-finales` | Cuento con dos finales | H | The opening scene | First choice between two paths | Each path has its own scene | Two different endings, then a third secret one |
| 3 | `maneja-nova` | Manejá a Nova | J | Move with the arrows | Reach the planet to earn a point | Each point sends the planet elsewhere | At 5 points: a new world and a win |
| 4 | `tesoro` | Búsqueda del tesoro | J | Reach the treasure: a point | It appears elsewhere | A guard patrols it, and touching it loses points | Phase 2 at 5 points with a faster guard, win at 10 |
| 4 | `chispa` | Que no te atrape Chispa | J | Chispa bounces; a touch loses | Collect coins while dodging | At 5 points: a second dragon | At 10 points: faster, with a new backdrop and a win |
| 4 | `cruza-ciudad` | Cruzá la ciudad | J | Reach the top for a point | One car crosses; a hit sends you back | Several lanes with different speeds | Phase 2 at 3 crossings: faster, win at 6 |
| 4 | `salto` | Salto de obstáculos | J | Jump with the space bar | An obstacle comes from the right; a hit loses | Each obstacle passed gives a point | Phases by points: faster, with a flying obstacle |
| 4 | `ataja` | Atajá lo que cae | J | Move the catcher | One object falls and gives a point | It falls from random places | Bad objects, faster phases, and a win |
| 5 | `tres-vidas` | Tres vidas | J | A lives variable and catching stars | Bombs take lives; zero loses | Clones rain down | Difficulty rises with the score, plus a record |
| 5 | `contrarreloj` | Contrarreloj | J | A timer that counts down | Points before time runs out | Bonus objects add seconds | Phases with less time and a win screen |
| 5 | `mascota-virtual` | Mascota virtual | J | Hunger and energy fall on their own | Feed it and put it to sleep | Its face depends on its state | Decide when it wins or gets sick; add a mini-game |
| 5 | `rebote` | Rebote | J | A ball bounces at an angle | The paddle returns it; the floor loses | Bricks made of clones that disappear | Speed rises and you win by clearing everything |
| 5 | `defensa` | Defensa del castillo | J | Move the cannon and shoot | Enemies approach as clones | Hits give points; contact takes lives | Waves that grow, then a final boss with lives |
| 5 | `memoria` | Memoria de sonidos | J | Play a sound for each button | The program plays a list | Compare the child's input with the list | The sequence grows every round; a mistake ends it |

### Two classes

Children use the platform twice: a trial class on 2026-11-04, and a second class some weeks later
with parents accompanying. The second must not repeat the first. Each game has a `class` field (1 or
2), and a teacher setting chooses the active class. A child sees the active class's games of their
level, plus every game they already started.

| L | Class 1 | Class 2 |
|---|---|---|
| 1 | `presentacion`, `mi-mascota` | `paseo-toby`, `baile-pulpi` |
| 2 | `la-carrera`, `banda-parque` | `chiste-robi`, `escondidas` |
| 3 | `caza-pulpi`, `maneja-nova` | `quiz`, `dos-finales` |
| 4 | `tesoro`, `chispa` | `cruza-ciudad`, `salto`, `ataja` |
| 5 | `tres-vidas`, `contrarreloj`, `mascota-virtual` | `rebote`, `defensa`, `memoria` |

Class 2 also adds:

- **Show what you made.** On entry a child can open their class 1 project in show mode.
- **Invent your game.** A design card (hero, goal, rule, what gets harder) becomes the child's own
  guide with no predefined solution.
- **Class arcade.** At the end, children publish a project and play their classmates' games.
- **Level review.** Teachers adjust levels using what class 1 recorded.

More games can join later: a game is data, and it only needs a passing proof.

### Class data

Each project records when each step was completed. The teacher panel shows, per game and child, the
time spent, the current step and the steps where children get stuck. Class 1 uses this to measure
the 25 to 40 minute estimate and to adjust levels and games before class 2.

### Backend

Express 5 on Node 24 with `node:sqlite`, running TypeScript directly through native type stripping.
Production serves the built client from the same process.

Access model:

- The app opens directly on the name screen: a field that filters as the child types, above large
  name buttons to tap, because first graders may not be able to type it. No child password: the
  threat is a classmate opening a project, which is acceptable in a supervised class.
- `ADMIN_PASSWORD`: teacher panel. Constant-time comparison and login rate limit.
- Signed, httpOnly, `SameSite=Strict` cookies signed with `SESSION_SECRET`. The server refuses to
  start in production when a secret is missing.

API:

- `GET /api/students`, `POST /api/session { studentId }`, `GET /api/session`, `DELETE /api/session`
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
- [ ] **T05 Workshop flow.** Name screen, level chooser, autosave with offline fallback.
      Route: delegated. Checks: typecheck, Vitest, build, browser capture.
- [ ] **T06 Class 1 catalog, levels 1 and 2.** 4 games with guides and proofs. Route: delegated.
      Checks: Vitest proofs, browser capture of one game from each level.
- [ ] **T07 Class 1 catalog, levels 3 and 4.** 4 games with guides and proofs. Route: delegated.
      Checks: same.
- [ ] **T08 Class 1 catalog, level 5.** 3 games with guides and proofs. Route: delegated. Checks: same.
- [ ] **T09 Teacher panel.** Login, bulk import, level assignment, active class, progress and class
      data. Route: delegated. Checks: typecheck, Vitest, build, browser capture.
- [ ] **T10 Ready for class 1.** Real browser pass through the whole flow, remove the old `estudio/`,
      move `niveles/` to static serving, serve on the LAN. Route: delegated, then parent spot check.
      Checks: e2e against the production build.
- [ ] **T11 Class 2 catalog.** The other 12 games with guides and proofs. Route: delegated. Checks:
      Vitest proofs, browser capture.
- [ ] **T12 Class 2 activities.** Show what you made, invent your game, class arcade. Route:
      delegated. Checks: typecheck, Vitest, build, browser capture.
- [ ] **T13 Close.** Dockerfile, README, adjustments from class 1 data. Route: delegated. Checks: e2e
      against the production build.

## Acceptance criteria

- A child opens the app, enters or taps their name and sees only the active class's games of their
  level, the games they already started, and the free project.
- Class 1 records enough data to show time per game and where children get stuck.
- Each of the 23 games has at least 3 phases, the level's minimum steps, at least 3 challenges, and a
  passing headless proof.
- Finishing a game offers the next one, so no child hits a dead end during a 60-minute class.
- Closing the browser and logging in from another computer restores the child's project.
- A teacher can paste a class list, assign levels and see progress.
- The app works with the backend reachable and no internet access.
- `typecheck`, Vitest and the production build all pass.

## Progress

Exploration done. Branch `feat/estudio-por-niveles` created from `main` at `ce5eec0`.

Engram mirror `odd/estudio-por-niveles/tasks`: **pending**. Writes fail with `ambiguous_project`
because this repo is not a known Engram project. This file is the source of truth meanwhile.

## Verification evidence

None yet.

## Next step

T01.
