# Más juegos para elegir

## Objective

A child who finishes the showcase game of their level (or wants another) chooses between three ready-made games, each one played in a really different way.

## Problem and why

Owner request (2026-11-25): add games for when they finish, if there is room to innovate, and let them choose. Today there is one
game per level and leaving it signs the child out. The five existing games are all «catch» or «dodge»; the block language allows more.

## Scope

- Two new showcase games per level (ten), original, each with a mechanic no other game of the level uses.
- A screen to choose between the three games of the level, with progress. First entry still goes straight to the first game.
- Out of scope: new blocks, new art, database changes, the old mission list (SHOWCASE_ON stays).

## Catalog

| L | Id | Title | Played with | What is new |
|---|---|---|---|---|
| 1 | muestra-carrera | La gran carrera | click | Two racers: each click moves yours. Two children can play |
| 1 | muestra-concierto | El concierto | click | A music toy: each musician plays and dances |
| 2 | muestra-cadena | Reacción en cadena | click | One click starts a chain of messages |
| 2 | muestra-feria | La feria de las pelotas | click | Moving targets that cross the sky, and one not to touch |
| 3 | muestra-camino | El camino de piedras | arrows | An obstacle course: a touch sends you back to the start |
| 3 | muestra-concurso | El concurso de Robi | click | A quiz the child fills with their own questions |
| 4 | muestra-salto | Saltá sin parar | space | Jump over what comes |
| 4 | muestra-guardian | Cuidá el tesoro | click | Defend the treasure by clicking what comes close |
| 5 | muestra-fabrica | La fábrica de monedas | click | Economy: earn, buy helpers, earn faster |
| 5 | muestra-meteoritos | Lluvia de meteoritos | arrows and space | Shoot with clones |

## Constraints

- Same as `controles-claros.md`. Original games only: genres are fine, no recreation of a specific existing game.
- A game without a headless proof (it can be played to its goal, every card can be solved) does not ship.
- Controls, goal and hints come from the program. A quiz never points at the right answer.
- No push, no deploy without the owner asking: a push to `muestra-final` deploys.

## Workflow settings

- TDD off (no project configuration); runner `npx vitest run --maxWorkers=2`. RDD off (global).
- Branch `feat/mas-juegos` on top of `fix/fondos-grandes`. Route: delegated direct, one writer at a time (2+ files per task).
- Delivery: `exception-ok`. Forecast about 1,800 lines, mostly game data; the repository is delivered by direct push, without PRs.

## Tasks

- [x] T1 Several showcases per level, choosing screen, finishing a game offers another one, teacher views. Commits 5831315 and the `fix(picker)` after it. `showcasesFor`, `Showcase.tapAll`, `GamePicker` + `picker.ts`, `ShowcaseFlow.tsx`, finishing dialog, `drawn.tsx` (controls without session or Blockly), demo routes `#/3`, `#/3/juegos`, `#/3/<id>`. Checked in the browser with two temporary copies of games (not committed): entry, picker at 1366x768, 1200x800, 1024x600 (3 and 4 cards) and 390x844, progress, re-entry, «No soy», finishing dialog once, demo. Route: delegated, one writer.
- [x] T5 Progress reset from /docente, per child and per game, that cannot come back from an open game or an old local copy (owner request, 2026-11-25). The owner also asked to push and deploy everything when it is done. Commit c4fb698. Migration 2 `resets(student_id, game_id, epoch)`; effective epoch = game row + all-games row (game_id ''), so reset-all covers games that only exist as local copies. PUT carries `epoch` (missing = 0), 409 `progress_reset` checked and written in one transaction; the 404 of a game without a project carries `epoch` (old pages keep working). Client: local copy stores the epoch, `loadProject` discards stale copies, autosave status `reset`, StudioHost remounts fresh with a dismissible notice. Teacher: «Reiniciar progreso» per child (Alumnos), «Reiniciar juego» (Progreso). Checked: typecheck, 55 files / 1295 tests, build, two-context browser pass (child with the game open, teacher resets, notice, fresh game, nothing on the server, other child untouched), 1366x768 and 390x844.
- [x] T2 Games of levels 1 and 2 (four), with proofs. Commits 2e8990d (level 1: `carrera.ts`, `concierto.ts`) and abb283d (level 2: `cadena.ts`, `feria.ts`); registered in `SHOWCASE` and `gameIds.ts`, `kit.ts` gains `clicksOf`, proofs in `levels12.test.ts` and `controls.test.ts`. Checked: typecheck, 56 files / 1412 tests, tutorial pass of every card from every sprite at 1200x800, 1366x768 and 1024x600 (0 failures, no overflow), real-mouse play of each game, pickers. Route: delegated, one writer.
- [x] T3 Games of levels 3, 4 and 5 (six), with proofs. Commits 110b4c1 (level 3: `camino.ts`, `concurso.ts`), 70a3805 (level 4: `salto.ts`, `guardian.ts`), 00d0dce (level 5: `fabrica.ts`, `meteoritos.ts`), 41d8bca (legend: four faces without names when the point is exactly four characters) and e58a7cc (fixes after the browser pass). Registered in `SHOWCASE` and `gameIds.ts`; proofs in `levels345.test.ts` (bots through `Hand`, which sends held keys as the studio does: at once, after 140 ms, every 60 ms) at 16 and 20 ms frames, `drawn.test.ts`. Checked: typecheck, 58 files / 1616 tests, a bot won each game in the real browser (camino 34 s, concurso 3 questions, salto 31 s, guardian 16 s, fabrica 46 s, meteoritos 22 s), tutorial pass of every card from every sprite at 1200x800, 1366x768 and 1024x600 (0 failures), pickers and strips at the three sizes. Decisions: the sitting-still rule of `showcase.test.ts` has one exception, `TOUCH_ENDS = muestra-salto` (it must lose, but not before 2.5 s); the guardian has no lose in the base (an arrival costs a point, the card «Perder» adds it); the quiz has two answers per question (six answer characters shown and hidden by messages). Route: delegated, one writer.
- [ ] T6 Tutorials a child understands (owner report on «Si… si no», 2026-11-25): what it is for, one whole sentence for the current step, and the finished program to compare with, in every card of the fifteen games.
- [ ] T4 Browser pass of the ten games: controls, goal, every tutorial from every sprite, three screen sizes, touch.

## Progress

- T1 done: typecheck clean, 54 files / 1276 tests pass, build passes; the entry chunk grew 10 KB (467 to 478 KB) with no Blockly in it.
- Before this feature, on the same line of commits: backdrops shown large (0359c42), tutorials ask for the sprite first (5bdd916). 53 files / 1263 tests pass.
