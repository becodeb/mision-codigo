# Controles claros

## Objective

A child who opens any game knows, without reading, what to do: which keys or which character to click, and what the goal is.

## Problem and why

Reported by the owner (2026-11-25): in some games it is not clear whether you move with the arrows or click the character.
Verified on `muestra-final` (d97bb38): the controls are one line of text on the entry screen. After «¡Jugar!» nothing on
screen says them, and click games (levels 1 and 2) look the same as keyboard games (levels 3 to 5). A wrong attempt
(clicking Nova, pressing arrows in the star game, playing while stopped) gets no answer at all.

## Scope

- Controls are derived from the project's program, so they stay true after the child edits the game.
- In scope: the five showcase games, and the on-stage help for every other game that shares the stage.
- Out of scope: game rules, difficulty, cards, server, teacher panel.

## Constraints

- UI copy in Spanish (voseo, as in the app). Code, identifiers, comments and commits in English for new files; keep the style of each file.
- Small laptops (Chromebook 1200x800, touch): no filters, no per-frame markup rewrites.
- The stage must never be covered in a way that blocks a click. `prefers-reduced-motion` respected.
- No push, no deploy without the owner asking: the live site is used in classes.

## Workflow settings

- TDD off (no project configuration); runner `npx vitest run --maxWorkers=2`. RDD off (global).
- Branch `fix/controles-claros` from `becode/muestra-final` (d97bb38). Route: delegated direct, one writer (2+ files).
- Delivery: `ask-on-risk`. Forecast: about 450 lines.

## Tasks

- [x] T1 `controls.ts`: pure derivation of keys, movers and clickable sprites from a program, with tests. Commit 798861c; `controls.test.ts` (12 tests). Route: delegated, one writer.
- [x] T2 Legend: drawn controls and goal on the entry screen, always visible while playing and in the editor. Commit 8dd6fbd; `Controls.tsx`, `How.tsx`, `Showcase.goal` per game; checked in the browser at 1366x768, 1200x800 and a 440px-high window. Route: delegated, one writer.
- [x] T3 Coach: on-stage keys or hand until the child does it, back after idling, and an answer to wrong attempts. Commit 73a1ee0; `coach.ts` (headless state machine, 19 tests with fake timers), `session.coach.test.ts`, drawing in `stage.ts`. Route: delegated, one writer.
- [x] T4 Verify in the browser the five games: mouse, keyboard, touch, 1366x768 and 1200x800.

## Acceptance

- In the five games, the first frame of play shows the right control on the right character.
- Wrong input in every game gets a visible answer within a second.
- Editing the game (new key, new click, another drawing) updates the legend.
- Typecheck, tests and build pass.

## Progress

- Baseline: typecheck clean, 48 files / 1219 tests pass.
- T1-T3 done on the branch; typecheck clean, 51 files / 1256 tests pass, build passes. T4 (browser pass of all five games with mouse, keyboard and touch) is still the parent's.
- T4: browser pass on the five games at 1366x768, 1200x800 and 1024x600, mouse, keyboard and touch emulation: 0 failures.
  Fixed on the way: a click that moved more than 5 stage units was a drag and never counted (14 px: 0 of 11 clicks before;
  0 to 30 px: 32 of 32 after); Boo's game ended in silence with Boo hidden (now points at «Empezar»); hints of a removed sprite;
  hints while a key is held; wording and small drawings. Typecheck clean, 52 files / 1262 tests, build passes.
- Not verified: a real Chromebook, a real finger, the voice, and games outside the showcase in show mode.

## Next step

Owner decides push to `becode/muestra-final` and deploy, between classes.
