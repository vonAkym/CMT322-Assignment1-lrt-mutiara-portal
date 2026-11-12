// The Work hours part of the advisory form (UC06, UC07): a start and end time, or 24 hours, and the days.
// Its values live in the form as wh_from, wh_to ('HH:MM'), wh_days ('0,1,2', Monday is 0) and wh_all ('1' for 24 hours).
// v.work_hours only holds text saved earlier in another format, which the pickers cannot show.
import { DAYS, formatHours, overnight } from './workHours.js';

export const NO_HOURS = { wh_from: '', wh_to: '', wh_days: '', wh_all: '' };
export const daysOf = (v) => (v.wh_days ? v.wh_days.split(',').map(Number) : []);
export const hoursOf = (v) => ({ from: v.wh_from, to: v.wh_to, days: daysOf(v), allDay: !!v.wh_all });
export const hoursUsed = (v) => !!(v.wh_from || v.wh_to || v.wh_days || v.wh_all);

// The problem with the hours, or '' when they are fine (or not filled in at all, as they are optional).
export function hoursProblem(v) {
  if (!hoursUsed(v)) return '';
  const h = hoursOf(v);
  if (!h.allDay && (!h.from || !h.to)) return 'Choose the start and end time, or tick 24 hours.';
  if (!h.allDay && h.from === h.to) return 'The start and end time are the same. Tick 24 hours if the works never stop.';
  if (!h.days.length) return 'Tick the days the works take place.';
  return '';
}
// Where the cursor goes for that problem.
export const hoursFieldId = (v) => (!v.wh_all && (!v.wh_from || !v.wh_to || v.wh_from === v.wh_to) ? 'mwf' : 'mwd0');

const QUICK = [['Weekdays', [0, 1, 2, 3, 4]], ['Mon–Sat', [0, 1, 2, 3, 4, 5]], ['Every day', [0, 1, 2, 3, 4, 5, 6]]];

export default function WorkHoursField({ v, onChange, error }) {
  const days = daysOf(v);
  const h = hoursOf(v);
  const set = (patch) => onChange({ ...v, ...patch });
  const setDays = (list) => set({ wh_days: [...new Set(list)].sort((a, b) => a - b).join(',') });
  const toggle = (i) => setDays(days.includes(i) ? days.filter((d) => d !== i) : [...days, i]);
  const ready = hoursUsed(v) && !hoursProblem(v);

  return (
    <fieldset className="stack plain" aria-describedby={error ? 'mwe mwh' : 'mwh'}>
      <legend>Work hours (optional)</legend>
      {v.work_hours && (
        <p className="note" style={{ margin: 0 }}>Saved earlier as “{v.work_hours}”. Set the times and days below to replace it.{' '}
          <button type="button" className="btn s sm" onClick={() => set({ work_hours: '' })}>Remove it</button></p>
      )}
      <div className="whrow">
        <div><label htmlFor="mwf">Start time</label><input id="mwf" className="in" type="time" disabled={h.allDay} value={v.wh_from} onChange={(e) => set({ wh_from: e.target.value })} /></div>
        <div><label htmlFor="mwt">End time</label><input id="mwt" className="in" type="time" disabled={h.allDay} value={v.wh_to} onChange={(e) => set({ wh_to: e.target.value })} /></div>
        <label className="whcheck"><input type="checkbox" checked={h.allDay} onChange={(e) => set({ wh_all: e.target.checked ? '1' : '' })} /> 24 hours (works never stop)</label>
      </div>
      <div role="group" aria-labelledby="mwdl">
        <p className="whlabel" id="mwdl">Days</p>
        <div className="whdays">
          {DAYS.map((d, i) => (
            <label key={d} className="whday"><input type="checkbox" id={`mwd${i}`} checked={days.includes(i)} onChange={() => toggle(i)} />{d}</label>
          ))}
        </div>
        <div className="whquick">
          {QUICK.map(([label, list]) => <button type="button" key={label} className="btn s sm" onClick={() => setDays(list)}>{label}</button>)}
          {hoursUsed(v) && <button type="button" className="btn s sm" onClick={() => set(NO_HOURS)}>Clear hours</button>}
        </div>
      </div>
      {error && <p className="err" id="mwe">{error}</p>}
      <p className="mut hint" id="mwh" role="status">
        {ready ? <>Shown to the public as: <b>{formatHours(h)}</b>{overnight(h) ? ' (overnight, ending the next morning)' : ''}</>
          : 'Leave empty if the hours are not decided yet.'}
      </p>
    </fieldset>
  );
}
