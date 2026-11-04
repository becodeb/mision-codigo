/** What was observed for one measured quantity (a position, a wait, a variable, a face) over the runs. */
export interface Sampled {
  count: number;
  first: number | string;
  last: number | string;
  /** Times the value was different from the one before. */
  changes: number;
  /** Smallest and largest number seen; both 0 when the quantity is text. */
  min: number;
  max: number;
  /** How many different values were seen (counted up to a cap of 64). */
  distinct: number;
}

interface SampleRow extends Omit<Sampled, 'distinct'> {
  seen: Set<number | string>;
}

const SEEN_CAP = 64;

/**
 * Records what the program did, so a guide step can ask "did the child use a say block?" without
 * reading the code. Counts are per category (`say`, `move`, `score`, ...) and per sprite.
 * Stats accumulate across runs until `reset`.
 */
export class StatsRecorder {
  private ops = new Map<string, number>();
  private hats = new Map<string, number>();
  private touches = new Map<string, number>();
  private runs = new Map<string, number>();
  private samples = new Map<string, SampleRow>();
  /** Reached the win or lose block at least once. */
  won = false;
  lost = false;
  /** Highest score seen. */
  maxScore = 0;
  /** The host entered show mode. Set with `Machine.setShown`. */
  shown = false;
  /** Times the score went down (a penalty, or «fijar puntos» to a lower number). A new run starting from 0 is not one. */
  scoreDrops = 0;

  op(category: string, spriteId: string): void {
    bump(this.ops, category);
    bump(this.ops, `${spriteId}|${category}`);
  }

  hat(kind: string, spriteId: string): void {
    bump(this.hats, kind);
    bump(this.hats, `${spriteId}|${kind}`);
  }

  /**
   * A touch that really happened: the program asked whether `sprite` touches `target` (a sprite id, or `EDGE`)
   * and the answer was yes. Unlike `ran('touching')`, which only says the question was asked.
   */
  touch(spriteId: string, target: string): void {
    bump(this.touches, `${spriteId}>${target}`);
    bump(this.touches, '*');
  }

  /** Whether any touch happened, or with `spriteId` and `target`: that sprite touched that one (as seen from its own scripts). */
  touched(spriteId?: string, target?: string): boolean {
    return (this.touches.get(spriteId === undefined || target === undefined ? '*' : `${spriteId}>${target}`) ?? 0) > 0;
  }

  /** A command block of this type finished starting in script `index` of the sprite (clones count for the sprite they copy). */
  blockRun(spriteId: string, index: number, type: string): void {
    bump(this.runs, `${spriteId}#${index}|${type}`);
  }

  /** Times blocks of these types ran in a script of the sprite (all its scripts when `index` is left out). */
  blockRuns(spriteId: string, index: number | undefined, types: readonly string[]): number {
    let n = 0;
    for (const [key, count] of this.runs) {
      const at = key.indexOf('|');
      const [sprite, idx] = key.slice(0, at).split('#');
      if (sprite === spriteId && (index === undefined || Number(idx) === index) && types.includes(key.slice(at + 1))) n += count;
    }
    return n;
  }

  /** Remembers a measured value under a key such as `y|star` or `var|ánimo`. */
  sample(key: string, value: number | string): void {
    const row = this.samples.get(key);
    if (!row) {
      const num = typeof value === 'number';
      this.samples.set(key, { count: 1, first: value, last: value, changes: 0, min: num ? value : 0, max: num ? value : 0, seen: new Set([value]) });
      return;
    }
    row.count++;
    if (row.last !== value) row.changes++;
    row.last = value;
    if (typeof value === 'number') {
      row.min = Math.min(row.min, value);
      row.max = Math.max(row.max, value);
    }
    if (row.seen.size < SEEN_CAP) row.seen.add(value);
  }

  sampled(key: string): Sampled | undefined {
    const row = this.samples.get(key);
    if (!row) return undefined;
    const { seen, ...rest } = row;
    return { ...rest, distinct: seen.size };
  }

  /** Times a block of the category ran, in any sprite. */
  count(category: string): number {
    return this.ops.get(category) ?? 0;
  }

  ran(category: string): boolean {
    return this.count(category) > 0;
  }

  ranBy(spriteId: string, category: string): boolean {
    return (this.ops.get(`${spriteId}|${category}`) ?? 0) > 0;
  }

  /** Whether a script with this hat (`flag`, `click`, `key`, `recv`, `touching`, `points`, `clone`) started. */
  ranHat(kind: string): boolean {
    return (this.hats.get(kind) ?? 0) > 0;
  }

  ranHatBy(spriteId: string, kind: string): boolean {
    return (this.hats.get(`${spriteId}|${kind}`) ?? 0) > 0;
  }

  reset(): void {
    this.ops.clear();
    this.hats.clear();
    this.touches.clear();
    this.runs.clear();
    this.samples.clear();
    this.scoreDrops = 0;
    this.won = false;
    this.lost = false;
    this.maxScore = 0;
    this.shown = false;
  }
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
