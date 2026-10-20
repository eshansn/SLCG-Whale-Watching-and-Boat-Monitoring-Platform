import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartNoAxesCombined, MessageCircleQuestion, MessageSquareWarning, UsersRound } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import type { MonitoringAnalytics } from './analyticsApi';
import { caseDateParams, fullDay, shortDay } from './analyticsApi';

const axis = { axisLine: false, tickLine: false, tick: { fill: '#718096', fontSize: 10 }, minTickGap: 28 };

export default function AnalyticsCharts({ data }: { data: MonitoringAnalytics }) {
  const reduced = useReducedMotion();
  const [animate, setAnimate] = useState(true);
  const id = useId().replace(/:/g, '');
  const params = caseDateParams(data.from, data.to);
  const casePath = (kind: string) => `/sltda/complaints?${new URLSearchParams({ ...params, kind })}`;
  const labels = Object.fromEntries(data.trends.map(point => [point.start, point.start === point.end ? fullDay(point.start) : `${fullDay(point.start)} – ${fullDay(point.end)}`]));
  const tooltip = { labelFormatter: (value: unknown) => labels[String(value)] ?? String(value), isAnimationActive: false };
  return <div className="grid items-stretch gap-5 xl:grid-cols-[1.15fr_1fr]">
    <section aria-labelledby="passenger-trend-heading" className="sltda-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6"><div><h2 id="passenger-trend-heading" className="flex items-center gap-2 text-sm font-semibold"><UsersRound size={17} className="text-indigo-500" />Passenger registrations</h2><p className="mt-1.5 text-xs text-slate-500">New passenger profiles · {data.interval} totals</p></div><div className="text-right"><strong className="text-2xl font-semibold tabular-nums tracking-tight">{data.totals.newPassengers.toLocaleString()}</strong><p className="mt-1 text-[10px] text-slate-400">in selected period</p></div></div>
      <p className="sr-only">{data.totals.newPassengers} new passenger profiles from {fullDay(data.from)} through {fullDay(data.to)}. Exact counts are available in the data table below.</p>
      <div className="h-[250px] min-w-0 px-3 pt-5 sm:px-4" role="figure" aria-label="Passenger registration trend">
        {data.totals.newPassengers === 0 ? <EmptyChart text="No passenger registrations in this period" /> : <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={data.trends} accessibilityLayer margin={{ top: 12, right: 14, bottom: 0, left: -22 }}>
            <defs><linearGradient id={`${id}-passengers`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={.17} /><stop offset="100%" stopColor="#6366f1" stopOpacity={.01} /></linearGradient></defs>
            <CartesianGrid vertical={false} stroke="#eef0f5" strokeDasharray="3 4" /><XAxis dataKey="start" tickFormatter={shortDay} {...axis} dy={8} /><YAxis {...axis} allowDecimals={false} domain={[0, 'auto']} />
            <Tooltip {...tooltip} /><Area type="monotone" dataKey="passengers" name="New passengers" stroke="#6262df" strokeWidth={2.5} fill={`url(#${id}-passengers)`} activeDot={{ r: 4, strokeWidth: 3, stroke: '#fff' }} isAnimationActive={!reduced && animate} animationDuration={550} onAnimationEnd={() => setAnimate(false)} />
          </AreaChart>
        </ResponsiveContainer>}
      </div>
      <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-3 text-[11px] text-slate-500 sm:mx-6"><span>{data.totals.registrations.toLocaleString()} trip participation registrations</span><Link to={`/sltda/passengers?${new URLSearchParams({ from: data.from, to: data.to })}`} className="font-medium text-indigo-600 hover:underline">View passengers →</Link></div>
      <ChartData data={data} kind="passengers" />
    </section>
    <section aria-labelledby="case-trend-heading" className="sltda-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6"><div><h2 id="case-trend-heading" className="flex items-center gap-2 text-sm font-semibold"><ChartNoAxesCombined size={17} className="text-violet-500" />Complaints & inquiries</h2><p className="mt-1.5 text-xs text-slate-500">Submissions by passenger-selected type</p></div><div className="text-right"><strong className="text-2xl font-semibold tabular-nums tracking-tight">{data.totals.cases.toLocaleString()}</strong><p className="mt-1 text-[10px] text-slate-400">cases submitted</p></div></div>
      <div className="mx-5 mt-4 flex flex-wrap gap-4 text-xs sm:mx-6"><Link to={casePath('Complaint')} className="inline-flex items-center gap-1.5 text-amber-800 hover:underline"><MessageSquareWarning size={14} />Complaints <strong className="ml-1 tabular-nums">{data.totals.complaints}</strong></Link>
        <Link to={casePath('Inquiry')} className="inline-flex items-center gap-1.5 text-violet-700 hover:underline"><MessageCircleQuestion size={14} />Inquiries <strong className="ml-1 tabular-nums">{data.totals.inquiries}</strong></Link>
        {data.totals.unclassified > 0 && <Link to={casePath('Unclassified')} className="text-slate-500 hover:underline">Unclassified <strong>{data.totals.unclassified}</strong></Link>}</div>
      <p className="sr-only">{data.totals.complaints} complaints, {data.totals.inquiries} inquiries and {data.totals.unclassified} unclassified cases in the selected period. Exact counts are available in the data table below.</p>
      <div className="h-[218px] min-w-0 px-3 pt-3 sm:px-4" role="figure" aria-label="Complaint and inquiry submission trend">
        {data.totals.cases === 0 ? <EmptyChart text="No complaints or inquiries in this period" /> : <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart data={data.trends} accessibilityLayer margin={{ top: 12, right: 14, bottom: 0, left: -22 }}>
            <CartesianGrid vertical={false} stroke="#eef0f5" strokeDasharray="3 4" /><XAxis dataKey="start" tickFormatter={shortDay} {...axis} dy={8} /><YAxis {...axis} allowDecimals={false} domain={[0, 'auto']} /><Tooltip {...tooltip} />
            <Line type="monotone" dataKey="complaints" name="Complaints" stroke="#c1832d" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} isAnimationActive={!reduced && animate} animationDuration={500} onAnimationEnd={() => setAnimate(false)} />
            <Line type="monotone" dataKey="inquiries" name="Inquiries" stroke="#8b5fc4" strokeWidth={2.2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} isAnimationActive={!reduced && animate} animationDuration={500} onAnimationEnd={() => setAnimate(false)} />
            {data.totals.unclassified > 0 && <Line type="monotone" dataKey="unclassified" name="Unclassified" stroke="#64748b" dot={false} isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>}
      </div>
      <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 py-3 text-[11px] text-slate-500 sm:mx-6"><span>Type and workflow status are tracked separately</span><Link to={`/sltda/complaints?${new URLSearchParams(params)}`} className="font-medium text-indigo-600 hover:underline">View cases →</Link></div>
      <ChartData data={data} kind="cases" />
    </section>
  </div>;
}

function EmptyChart({ text }: { text: string }) {
  return <div className="flex h-full flex-col items-center justify-center rounded-lg bg-gradient-to-b from-slate-50/40 to-white px-4 text-center"><ChartNoAxesCombined size={30} strokeWidth={1.2} className="mb-3 text-slate-300" /><p className="text-xs font-medium text-slate-500">{text}</p><p className="mt-1.5 text-[11px] text-slate-400">Choose a different date range to explore activity.</p></div>;
}

function ChartData({ data, kind }: { data: MonitoringAnalytics; kind: 'passengers' | 'cases' }) {
  return <details className="border-t border-slate-100 px-5 py-3 sm:px-6"><summary className="w-fit text-[11px] font-medium text-slate-500 hover:text-indigo-600">View {kind === 'passengers' ? 'registration' : 'case'} data</summary>
    <div className="mt-3 max-h-56 overflow-auto"><table className="w-full text-left text-xs"><caption className="sr-only">{kind === 'passengers' ? 'Passenger registrations' : 'Case submissions'} within {fullDay(data.from)}–{fullDay(data.to)}. Weekly and monthly edge buckets include only selected dates.</caption><thead><tr className="border-b border-slate-100 text-slate-500"><th scope="col" className="py-2 pr-3">Period</th>{(kind === 'passengers' ? ['New profiles', 'Trip registrations'] : ['Complaints', 'Inquiries', 'Unclassified']).map(name => <th key={name} scope="col" className="px-2 py-2 text-right font-medium">{name}</th>)}</tr></thead>
      <tbody>{data.trends.map(point => <tr key={point.start} className="border-b border-slate-50"><th scope="row" className="whitespace-nowrap py-2 pr-3 font-normal">{shortDay(point.start)}{point.start !== point.end ? `–${shortDay(point.end)}` : ''}</th>{(kind === 'passengers' ? [point.passengers, point.registrations] : [point.complaints, point.inquiries, point.unclassified]).map((value, index) => <td key={index} className="px-2 py-2 text-right tabular-nums">{value}</td>)}</tr>)}</tbody></table></div>
  </details>;
}
