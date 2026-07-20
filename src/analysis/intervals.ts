export interface Interval {
  start: number;
  end: number;
}

export function sumDuration(intervals: Interval[]): number {
  return intervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const result: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);
    if (start < end) {
      result.push({ start, end });
    }
    if (a[i].end < b[j].end) {
      i++;
    } else {
      j++;
    }
  }
  return result;
}

/** Интервалы, где НИ ОДИН из входных наборов не активен, в пределах [0, totalDuration]. */
export function complementIntervals(intervals: Interval[], totalDuration: number): Interval[] {
  const merged = mergeIntervals(intervals);
  const result: Interval[] = [];
  let cursor = 0;
  for (const interval of merged) {
    if (interval.start > cursor) {
      result.push({ start: cursor, end: interval.start });
    }
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < totalDuration) {
    result.push({ start: cursor, end: totalDuration });
  }
  return result;
}
