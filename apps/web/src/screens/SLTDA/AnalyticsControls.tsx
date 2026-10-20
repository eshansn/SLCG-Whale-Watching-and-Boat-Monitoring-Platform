import { useRef, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { fullDay, localToday, moveDay } from './analyticsApi';
import type { AnalyticsInterval } from './analyticsApi';

export default function AnalyticsControls({ from, to, interval, onChange }: {
  from: string; to: string; interval: AnalyticsInterval; onChange: (from: string, to: string, interval: AnalyticsInterval) => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [first, setFirst] = useState(from);
  const [last, setLast] = useState(to);
  const [error, setError] = useState('');
  const today = localToday();
  return <div className="flex flex-wrap items-center gap-2">
    <div aria-label="Reporting period presets" className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      {[7, 30, 90].map(days => <button type="button" key={days} aria-pressed={from === moveDay(today, 1 - days) && to === today}
        onClick={() => onChange(moveDay(today, 1 - days), today, days === 90 ? 'weekly' : 'daily')}
        className={`min-h-8 rounded-md px-3 text-xs font-medium transition-colors ${from === moveDay(today, 1 - days) && to === today ? 'bg-[#17243e] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>{days} days</button>)}
    </div>
    <details ref={details} className="relative" onKeyDown={event => { if (event.key === 'Escape' && details.current?.open) { details.current.open = false; details.current.querySelector('summary')?.focus(); } }}><summary className="flex min-h-[42px] list-none items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 [&::-webkit-details-marker]:hidden"><CalendarDays size={15} />{fullDay(from)} — {fullDay(to)}<ChevronDown size={13} /></summary>
      <form onSubmit={e => {
        e.preventDefault();
        const days = (Date.parse(last) - Date.parse(first)) / 86400000;
        if (!Number.isFinite(days) || days < 0 || days > 365) { setError('Choose a range of up to 366 days, with the end on or after the start.'); return; }
        onChange(first, last, interval); setError(''); if (details.current) details.current.open = false;
      }} className="absolute left-0 z-30 mt-2 w-[min(340px,88vw)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl sm:left-auto sm:right-0">
        <p className="text-sm font-semibold">Custom reporting period</p><p className="mt-1 text-xs leading-5 text-slate-500">Inclusive calendar dates in Sri Lanka time.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-slate-500">From<input aria-label="Reporting period from" type="date" required value={first} onChange={e => setFirst(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-700" /></label>
          <label className="text-xs text-slate-500">Through<input aria-label="Reporting period through" type="date" required value={last} onChange={e => setLast(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 px-2 text-sm text-slate-700" /></label></div>
        {error && <p role="alert" className="mt-3 text-xs text-red-600">{error}</p>}<button type="submit" className="mt-4 min-h-10 w-full rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white hover:bg-indigo-700">Apply date range</button>
      </form>
    </details>
    <label className="sr-only" htmlFor="analytics-interval">Chart interval</label><select id="analytics-interval" value={interval} onChange={e => onChange(from, to, e.target.value as AnalyticsInterval)} className="min-h-[42px] rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
  </div>;
}
