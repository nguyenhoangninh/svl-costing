// v1.14.92 (audit ACC-03 / AUD-14): calculation revision of the steps whose results are saved with the period.
// Bump a number when a change to the engine changes the numbers that step produces (not for UI or wording changes).
// STEP 4 / STEP 5 results store the revision they were computed with; a different one makes them OUTDATED
// ("cách tính đã đổi") so an upgrade never leaves an old result showing as CURRENT.
// test/synth.mjs refuses to rewrite its snapshot with changed STEP 2–4 / STEP 5 numbers unless the matching entry here changed.
export const CALC_REV = { step4: 1, step5: 1 };

/** Why a saved result is out of date because the calculation changed, or ''. Results saved before v1.14.92 carry no
 *  revision and count as revision 1 (the calculation they were computed with is the one revision 1 names). */
export function calcRevReason(step, saved, label) {
  const was = saved === undefined || saved === null ? 1 : saved, now = CALC_REV[step];
  return was === now ? '' : `Cách tính ${label} đã đổi (phiên bản tính ${was} → ${now}) – chạy lại ${label}`;
}
