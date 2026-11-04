/**
 * Records what the program did, so a guide step can ask "did the child use a say block?" without
 * reading the code. Counts are per category (`say`, `move`, `score`, ...) and per sprite.
 * Stats accumulate across runs until `reset`.
 */
export class StatsRecorder {
  private ops = new Map<string, number>();
  private hats = new Map<string, number>();
  /** Reached the win or lose block at least once. */
  won = false;
  lost = false;
  /** Highest score seen. */
  maxScore = 0;
  /** The host entered show mode. Set with `Machine.setShown`. */
  shown = false;

  op(category: string, spriteId: string): void {
    bump(this.ops, category);
    bump(this.ops, `${spriteId}|${category}`);
  }

  hat(kind: string, spriteId: string): void {
    bump(this.hats, kind);
    bump(this.hats, `${spriteId}|${kind}`);
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
    this.won = false;
    this.lost = false;
    this.maxScore = 0;
    this.shown = false;
  }
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}
