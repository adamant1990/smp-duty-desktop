const minutes = value => {
  const m = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
};

const segments = (start, end) => {
  const s = minutes(start), e = minutes(end);
  if (s == null || e == null) return [];
  if (s === e) return [[0, 1440]];
  return s < e ? [[s, e]] : [[s, 1440], [0, e]];
};

export const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => {
  const a = segments(aStart, aEnd), b = segments(bStart, bEnd);
  return a.some(x => b.some(y => x[0] < y[1] && y[0] < x[1]));
};

export const hasAssignmentConflict = (a, b) =>
  a?.staff_id === b?.staff_id &&
  intervalsOverlap(a?.start_time, a?.end_time, b?.start_time, b?.end_time);