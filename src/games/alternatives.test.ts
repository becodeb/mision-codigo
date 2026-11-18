/**
 * Programs that do what the guide asks, but built another way than the reference solution: blocks in another
 * order, split in two scripts with the same start, the rule written in the other sprite, an equivalent block.
 * Each one is played with the game's own `play` and every step has to pass, as in the studio.
 */
import { describe, expect, it } from 'vitest';
import type { ProjectProgram, Script } from '../language/ir.ts';
import {
  addScore, backdrop, bounce, face, fBackdrop, fClick, fFace, fFlag, fGrow, fJump, fLeft, fNote, fRepeat, fRight, fSay, fSound, fSpin, fStar, fText, fUp, fWait,
  forever, goToRandom, hide, ifElse, ifThen, jump, lose, move, moveWithArrows, onClick, onFlag, onKey, onPoints, onTouching, point, repeat, say,
  sayFor, setScore, show, sound, touching, wait, win,
} from '../language/ir.ts';
import { GAMES } from './catalog.ts';
import { ProofGame, stepsOf } from './proof.ts';
import type { GameDefinition } from './types.ts';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const gameOf = (id: string): GameDefinition => GAMES.find((g) => g.id === id)!;

/** The reference solution with some sprites' scripts replaced. */
function variant(game: GameDefinition, scripts: Record<string, Script[]>): ProjectProgram {
  const program = clone(game.solution.program);
  for (const [id, list] of Object.entries(scripts)) {
    const sp = program.sprites.find((s) => s.id === id);
    if (!sp) throw new Error(`${game.id}: no sprite ${id}`);
    sp.scripts = clone(list);
  }
  return program;
}

/** Plays the program with the game's own play and returns the steps that never passed. */
async function missing(game: GameDefinition, program: ProjectProgram): Promise<string[]> {
  const driver = new ProofGame(game, program);
  await game.solution.play(driver);
  driver.poll();
  driver.machine.dispose();
  return stepsOf(game).filter((s) => !driver.done.has(s.id)).map((s) => s.id);
}

const CASES: [string, string, Record<string, Script[]>][] = [
  ['m1-circo', 'the number split in two manitos: jump and sound in one, spin and star in the other', {
    toby: [fClick(fJump(), fSound('aplauso')), fClick(fStar(), fSpin())],
  }],
  ['m1-robi-espacio', 'festeja: the jump before the happy face', {
    robi: [fFlag(fRight(), fRight(), fSay('HOLA'), fBackdrop('espacio'), fJump(), fFace('feliz'))],
  }],
  ['m1-mar', 'Michi escapes up and to the right instead of to the left', {
    michi: [fClick(fFace('sorpresa'), fSay('MIEDO'), fUp(), fRight())],
  }],
  ['m1-arregla', 'the apple gives its star with no sound, Michi is happy and also surprised', {
    manzana: [fClick(fStar())],
    michi: [fClick(fStar(), fFace('sorpresa'), fFace('risa'), fSay('GRACIAS'))],
  }],
  ['m2-baile', 'spin before jump inside the loop, the ending sound before the face', {
    toby: [fClick(fRepeat(3, fNote('do'), fSpin(), fJump()), fSound('aplauso'), fFace('feliz'))],
  }],
  ['m2-arregla', 'the run is two loops of two steps, and the way back is four plain arrows', {
    nova: [fFlag(fRepeat(2, fRight(), fRight()), fJump(), fStar(), fSay('GUAU'), fWait(1), fLeft(), fLeft(), fLeft(), fLeft())],
  }],
  ['m2-arregla', 'the run is four plain arrows with no loop', {
    nova: [fFlag(fRight(), fRight(), fRight(), fRight(), fStar(), fSay('GUAU'), fJump(), fWait(1), fRepeat(4, fLeft()))],
  }],
  ['m3-teclado', 'scripts in another order, point after move, «decir» without seconds', {
    nova: [onClick(face('feliz'), say('¡Soy Nova!')), onKey(' ', sound('boing'), jump()), onKey('ArrowLeft', move(10), point('-90')), onKey('ArrowRight', move(10), point('90'))],
  }],
  ['m3-fugaces', 'the points start at 0 from Robi’s flag, not the star’s', {
    estrella: [onClick(addScore(1), goToRandom())],
    robi: [onFlag(setScore(0)), onPoints(5, sayFor('¡Ganaste!', 1), win())],
  }],
  ['m3-arquero', 'the catch scores from Toby’s side; the ball only jumps away', {
    pelota: [onFlag(point('-90'), setScore(0), repeat(30, move(10))), onTouching('toby', goToRandom(), sound('boing'))],
    toby: [onTouching('pelota', addScore(1), sayFor('¡Atajada!', 1), face('feliz')), onKey(' ', jump())],
  }],
  ['m3-arregla', 'Chispa jumps three times without a loop', {
    chispa: [onClick(face('enojo'), jump(), jump(), jump())],
  }],
  ['m4-tesoro', 'the stone and the treasure hold the lose and win rules', {
    auto: [onFlag(forever(moveWithArrows(4)))],
    piedra: [onFlag(point('0'), forever(move(3), bounce())), onTouching('auto', lose())],
    tesoro: [onTouching('auto', win(), sound('aplauso'))],
  }],
  ['m4-arregla', 'the swap is fixed from the coin and dragon side', {
    michi: [onFlag(forever(moveWithArrows(5))), onPoints(5, sound('aplauso'), win())],
    chispa: [onFlag(forever(bounce(), move(3))), onTouching('michi', lose())],
    moneda: [onTouching('michi', addScore(1), goToRandom())],
  }],
  ['m5-fases', 'the guardian holds the lose rule', {
    auto: [onFlag(forever(moveWithArrows(4))), onTouching('moneda', addScore(1)), onPoints(3, backdrop('castillo')), onPoints(6, win())],
    guardian: [onFlag(hide()), onPoints(3, show(), forever(move(3), bounce())), onTouching('auto', lose())],
  }],
  ['m5-si', '«si … si no» instead of «si»', {
    nova: [
      onFlag(forever(moveWithArrows(5), ifElse(touching('estrella'), [addScore(1)], [wait(0)]), ifThen(touching('bomba'), lose()))),
      onPoints(10, sound('aplauso'), win()),
      onPoints(5, backdrop('espacio')),
    ],
  }],
  ['chispa-facil', 'the coin scores and jumps by itself; Chispa holds the lose rule', {
    michi: [onFlag(forever(moveWithArrows(5))), onPoints(8, sound('aplauso'), win())],
    chispa: [onFlag(forever(move(3), bounce())), onTouching('michi', lose())],
    moneda: [onTouching('michi', sound('magia'), goToRandom(), addScore(1))],
  }],
  ['mi-mascota-facil', 'the reactions split in three manitos', {
    gata: [
      fClick(fSound('miau'), fSpin()),
      fClick(fText('Soy Mimi'), fJump()),
      fClick(fGrow(), fGrow(), fSay('GRACIAS'), fFace('feliz')),
      fFlag(fBackdrop('castillo'), fRight(), fJump(), fRight()),
    ],
  }],
  ['banda-parque-facil', 'the chorus repeats the same note twice', {
    flauta: [fClick(fNote('do'), fNote('mi'), fNote('sol'), fJump(), fNote('la'), fNote('sol'), fSpin(), fNote('mi'), fRepeat(3, fNote('do'), fNote('do')))],
  }],
  ['caza-pulpi-facil', 'the point and the escape in two «al hacer clic»', {
    pulpi: [
      onFlag(setScore(0), repeat(60, repeat(25, move(3)), point('-90'), repeat(25, move(3)), point('90'), wait(0.5), goToRandom())),
      onClick(sound('magia'), addScore(1)),
      onClick(goToRandom()),
      onPoints(10, face('risa'), sound('aplauso'), win()),
    ],
  }],
];

describe('a correct program built another way passes every step', () => {
  it.each(CASES)('%s: %s', async (id, _how, scripts) => {
    const game = gameOf(id);
    expect(await missing(game, variant(game, scripts))).toEqual([]);
  });
});
