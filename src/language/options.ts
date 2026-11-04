/** Dropdown vocabularies shared by the blocks, the runtime and the games. Values are stable ids. */

export type Option = readonly [label: string, value: string];

export const PHRASES: readonly Option[] = [
  ['👋 ¡Hola!', 'HOLA'], ['😊 ¿Cómo te llamás?', 'NOMBRE'], ['🤝 ¿Querés ser mi amigo?', 'AMIGO'], ['⚽ ¡Vamos a jugar!', 'JUGAR'],
  ['🍰 ¡Tengo hambre!', 'HAMBRE'], ['😂 ¡Ja, ja, ja!', 'RISA'], ['😮 ¡Guau!', 'GUAU'], ['😱 ¡Qué miedo!', 'MIEDO'],
  ['🆘 ¡Ayuda!', 'AYUDA'], ['🙏 ¡Gracias!', 'GRACIAS'], ['❤️ ¡Te quiero!', 'QUIERO'], ['👍 ¡Sí!', 'SI'], ['👎 ¡No!', 'NO'], ['👋 ¡Chau!', 'CHAU'],
];
/** Phrase id to the text a picture-tier `f_say` speaks. */
export const PHRASE: Readonly<Record<string, string>> = Object.fromEntries(PHRASES.map(([text, id]) => [id, text]));

export type FaceId = 'feliz' | 'risa' | 'triste' | 'sorpresa' | 'enojo' | 'dormido';
export const FACES_PICTURE: readonly Option[] = [['😀', 'feliz'], ['😂', 'risa'], ['😢', 'triste'], ['😮', 'sorpresa'], ['😠', 'enojo'], ['😴', 'dormido']];
export const FACES_TEXT: readonly Option[] = [
  ['feliz', 'feliz'], ['muerta/o de risa', 'risa'], ['triste', 'triste'], ['sorprendida/o', 'sorpresa'], ['enojada/o', 'enojo'], ['dormida/o', 'dormido'],
];

export const SOUNDS_PICTURE: readonly Option[] = [
  ['🐱 miau', 'miau'], ['🐶 guau', 'guau'], ['👏 aplausos', 'aplauso'], ['🥁 tambor', 'tambor'], ['✨ magia', 'magia'], ['🦘 boing', 'boing'], ['🤖 bip', 'bip'],
];
export const SOUNDS_TEXT: readonly Option[] = SOUNDS_PICTURE.map(([label, id]) => [label.replace(/^\S+\s/, ''), id] as const);

export const NOTES: readonly Option[] = [['do', 'do'], ['re', 're'], ['mi', 'mi'], ['fa', 'fa'], ['sol', 'sol'], ['la', 'la'], ['si', 'si']];

/** Text-tier messages (`a_send` / `a_recv`). */
export const MSGS: readonly Option[] = [
  ['tu turno', 'm1'], ['siguiente', 'm2'], ['empezar', 'm3'], ['fin', 'm4'],
  ['fase 2', 'p2'], ['fase 3', 'p3'], ['fase 4', 'p4'], ['final A', 'fa'], ['final B', 'fb'],
];

/** Picture-tier envelopes (`f_send` / `f_recv`): the colour is the message. */
export const ENVELOPES: readonly Option[] = [['rojo', 'red'], ['azul', 'blue'], ['amarillo', 'yellow']];

export const KEYS: readonly Option[] = [
  ['flecha derecha', 'ArrowRight'], ['flecha izquierda', 'ArrowLeft'], ['flecha arriba', 'ArrowUp'], ['flecha abajo', 'ArrowDown'], ['espacio', ' '],
];

/** Directions of `a_point`: degrees clockwise from up, as strings. */
export const DIRS: readonly Option[] = [['la derecha', '90'], ['la izquierda', '-90'], ['arriba', '0'], ['abajo', '180']];

/** Special touch target: the stage border. */
export const EDGE = 'EDGE';
