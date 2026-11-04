import type { ImportLineError } from '../shared/api.ts';
import { isLevelId } from '../shared/levels.ts';
import type { RosterUpsert } from './db.ts';

export const MAX_ROSTER_LINES = 2000;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export interface RosterLine extends RosterUpsert {
  line: number;
}

/** Parses `Nombre, grupo, nivel` lines (comma or tab separated). Valid lines survive invalid ones. */
export function parseRoster(text: string): { rows: RosterLine[]; errors: ImportLineError[] } {
  const rows: RosterLine[] = [];
  const errors: ImportLineError[] = [];
  let seen = 0;

  text.split(/\r\n|\r|\n/).forEach((raw, index) => {
    const line = index + 1;
    if (raw.trim() === '') return;
    seen++;
    if (seen > MAX_ROSTER_LINES) {
      if (seen === MAX_ROSTER_LINES + 1) {
        errors.push({ line, message: `Se importan como máximo ${MAX_ROSTER_LINES} líneas por vez.` });
      }
      return;
    }

    const parts = (raw.includes('\t') ? raw.split('\t') : raw.split(',')).map((part) => part.trim());
    if (seen === 1 && parts[0].toLowerCase() === 'nombre') return; // header row pasted from a spreadsheet
    if (parts.length !== 3) {
      errors.push({ line, message: 'Se esperaban 3 columnas: nombre, grupo y nivel.' });
      return;
    }

    const [name, group, rawLevel] = parts;
    if (name === '' || name.length > 60 || CONTROL_CHARS.test(name)) {
      errors.push({ line, message: 'El nombre debe tener entre 1 y 60 caracteres.' });
      return;
    }
    if (group.length > 40 || CONTROL_CHARS.test(group)) {
      errors.push({ line, message: 'El grupo puede tener hasta 40 caracteres.' });
      return;
    }
    const level = /^[1-5]$/.test(rawLevel) ? Number(rawLevel) : NaN;
    if (!isLevelId(level)) {
      errors.push({ line, message: 'El nivel debe ser un número del 1 al 5.' });
      return;
    }
    rows.push({ line, name, group, level });
  });

  return { rows, errors };
}
