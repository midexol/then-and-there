import type { BirthDecade, EraWindow } from "../types.js";

/**
 * Era window from the birth decade: midpoint + 10 to midpoint + 30, peak at midpoint + 14
 * (the musical reminiscence bump peaks around age 14).
 */
export function eraWindow(decade: BirthDecade): EraWindow {
  const start = parseInt(decade.slice(0, 4), 10);
  const mid = start + 5;
  return { from: mid + 10, to: mid + 30, peak: mid + 14 };
}

export function inEra(year: number | undefined, w: EraWindow): boolean {
  return year === undefined || (year >= w.from && year <= w.to);
}

/** 0 at the peak, growing with distance; used as a soft ranking penalty. */
export function eraDistance(year: number | undefined, w: EraWindow): number {
  return year === undefined ? 2 : Math.abs(year - w.peak) / 4;
}
