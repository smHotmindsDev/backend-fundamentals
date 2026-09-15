// Frozen "today" for the whole suite. The app receives it through its
// injected clock; the fixture loader resolves `CURRENT_DATE ± n` against
// the same value, so the app and the seed never disagree on the date.
//
// The shape of the clock the app accepts is your design decision. This
// file only fixes the date and gives you date arithmetic that matches
// Postgres `date` semantics (calendar days, no time zone).

export const TEST_TODAY = '2026-09-15';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** '2026-09-15' + 14 -> '2026-09-29' (UTC calendar arithmetic). */
export function addDays(isoDate, days) {
    if (!ISO_DATE.test(isoDate)) throw new Error(`addDays: not a YYYY-MM-DD date: ${isoDate}`);
    const d = new Date(`${isoDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
