// Things that turn up for everyone aren't specific to anyone. Qloo's audience data is thin for some places, so the same
// globally famous names (a film, a snack brand, an American singer) come back for people in very different countries.
// This remembers, in memory only, which countries each Qloo item was recently offered for, and lets the ranking move an
// item down a little for every *other* country it has already been offered to. Places are exempt: they are local by nature.
// It is a nudge, not a ban: if an item is the only good option, it still gets picked.
import { fold } from "./safety.js";

/** "Mumbai, India" → "india". With no comma, the whole region. */
export function countryKey(region: string): string {
  return fold(region.split(",").pop() ?? region).trim();
}

export class RecentlyServed {
  private seen = new Map<string, Set<string>>();
  constructor(private max = 4000) {}

  /** How many other countries this item was recently offered for. */
  elsewhere(id: string, country: string): number {
    const set = this.seen.get(id);
    if (!set) return 0;
    return set.has(country) ? set.size - 1 : set.size;
  }

  record(ids: string[], country: string): void {
    for (const id of ids) {
      const set = this.seen.get(id) ?? new Set<string>();
      set.add(country);
      this.seen.delete(id); // re-insert so the oldest entries are the first to go
      this.seen.set(id, set);
    }
    while (this.seen.size > this.max) this.seen.delete(this.seen.keys().next().value as string);
  }

  clear(): void {
    this.seen.clear();
  }
}

/** Rank positions an item falls for each other country it has been offered to, up to a cap. */
export const REPEAT_STEP = 6;
export const REPEAT_CAP = 18;
export const repeatLean = (elsewhere: number) => Math.min(REPEAT_CAP, REPEAT_STEP * elsewhere);

/** Shared by every session this server builds. Tests pass their own. */
export const recentlyServed = new RecentlyServed();
