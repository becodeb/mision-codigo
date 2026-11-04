/** Helpers shared by the block-editor tests (kept out of the *.test files so importing them registers no tests). */
import * as ir from './ir.ts';
import type { Block, Script } from './ir.ts';

/** A program that uses every block type of the language at least once. */
export function everyBlockProgram(): Script[] {
  const { sprite: _sprite, ...b } = ir;
  void _sprite;
  const picture = [
    b.fFlag(
      b.fSay('HOLA'), b.fText('Hola, Pulpi'), b.fRight(), b.fLeft(), b.fUp(), b.fDown(), b.fJump(), b.fSpin(), b.fFace('risa'), b.fGrow(), b.fShrink(),
      b.fSound('miau'), b.fBackdrop('mar'), b.fStar(), b.fWait(3),
      b.fRepeat(4, b.fHide(), b.fShow(), b.fNote('sol'), b.fRandom()),
      b.fSend('red'),
    ),
    b.fClick(b.fSay('SI')),
    b.fRecv('blue', b.fSay('NO')),
  ];
  const text = [
    b.onFlag(
      b.send('p2'), b.move(10), b.point('90'), b.pointDeg(45), b.turn(15), b.pointTowards('b'), b.changeX(5), b.changeY(-5), b.setX(1), b.setY(2),
      b.goTo(3, 4), b.goToSprite('b'), b.goToRandom(), b.glide(1, 2, 3), b.jump(), b.moveWithArrows(4), b.bounce(),
      b.say('hola'), b.sayFor('chau', 2), b.thinkFor('mmm', 1), b.face('enojo'), b.changeSize(10), b.setSize(120), b.show(), b.hide(), b.backdrop('espacio'),
      b.sound('guau'), b.note('la'), b.wait(0.5),
      b.repeat(3, b.changeX(1), b.say(b.join(b.posX(), b.posY()))),
      b.ifThen(b.and(b.or(b.not(b.touching('b')), b.keyPressed('ArrowUp')), b.gt(b.score(), 2)), b.addScore(1)),
      b.ifElse(b.lt(b.timer(), 10), [b.say(b.distanceTo('b'))], [b.say(b.answer())]),
      b.repeatUntil(b.eq(b.variable('vidas'), 0), b.changeVar('vidas', -1)),
      b.waitUntil(b.touching('EDGE')),
      b.createClone(), b.createClone('b'), b.setScore(0), b.addScore(2), b.setVar('vidas', b.add(b.sub(b.mul(b.div(b.mod(7, 2), 3), 4), 5), b.randomBetween(1, 6))),
      b.changeVar('vidas', 1), b.listAdd('cosas', 'manzana'), b.listDelete('cosas', 1), b.listSet('cosas', 2, 'pera'),
      b.say(b.listItem('cosas', 1)), b.say(b.listLength('cosas')), b.ifThen(b.listHas('cosas', 'pera'), b.listClear('cosas')),
      b.ask('¿Cómo te llamás?'), b.stopOthers(), b.win(), b.lose(),
      b.forever(b.ifThen(b.keyPressed(' '), b.stopThis())),
    ),
    b.onClick(b.stopAll()),
    b.onKey('ArrowLeft', b.changeX(-10)),
    b.onReceive('fb', b.say('final B')),
    b.onPoints(5, b.say('cinco')),
    b.onTouching('b', b.deleteClone()),
    b.onCloneStart(b.deleteClone()),
  ];
  return [...picture, ...text];
}

export const stripIds = <T extends Block>(blk: T): T => JSON.parse(JSON.stringify(blk, (k, v) => (k === 'id' ? undefined : v)));

/** Every field, input and statement of `a` is in `b` with the same value (b may add default sockets). */
function covers(a: Block, b: Block, path: string = a.type): string[] {
  const problems: string[] = [];
  if (a.type !== b.type) return [`${path}: type ${a.type} vs ${b.type}`];
  for (const [k, v] of Object.entries(a.fields)) if (String(b.fields[k]) !== String(v)) problems.push(`${path}.${k}: ${String(v)} vs ${String(b.fields[k])}`);
  for (const [k, v] of Object.entries(a.inputs)) {
    if (!b.inputs[k]) problems.push(`${path}.${k}: missing input`);
    else problems.push(...covers(v, b.inputs[k], `${path}.${k}`));
  }
  for (const key of ['body', 'elseBody'] as const) {
    if (a[key].length !== b[key].length) problems.push(`${path}.${key}: ${a[key].length} vs ${b[key].length} statements`);
    else a[key].forEach((child, i) => problems.push(...covers(child, b[key][i], `${path}.${key}[${i}]`)));
  }
  return problems;
}

export function scriptsCover(a: readonly Script[], b: readonly Script[]): string[] {
  if (a.length !== b.length) return [`${a.length} scripts vs ${b.length}`];
  return a.flatMap((s, i) => [
    ...covers(s.hat, b[i].hat, `script${i}.hat`),
    ...(s.body.length === b[i].body.length ? s.body.flatMap((x, j) => covers(x, b[i].body[j], `script${i}[${j}]`)) : [`script${i}: ${s.body.length} vs ${b[i].body.length} statements`]),
  ]);
}

