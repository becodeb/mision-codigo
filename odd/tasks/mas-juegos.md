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
- [ ] T5 Progress reset from /docente, per child and per game, that cannot come back from an open game or an old local copy (owner request, 2026-11-25). The owner also asked to push and deploy everything when it is done.
- [ ] T2 Games of levels 1 and 2 (four), with proofs.
- [ ] T3 Games of levels 3, 4 and 5 (six), with proofs.
- [ ] T4 Browser pass of the ten games: controls, goal, every tutorial from every sprite, three screen sizes, touch.

## Progress

- T1 done: typecheck clean, 54 files / 1276 tests pass, build passes; the entry chunk grew 10 KB (467 to 478 KB) with no Blockly in it.
- Before this feature, on the same line of commits: backdrops shown large (0359c42), tutorials ask for the sprite first (5bdd916). 53 files / 1263 tests pass.
