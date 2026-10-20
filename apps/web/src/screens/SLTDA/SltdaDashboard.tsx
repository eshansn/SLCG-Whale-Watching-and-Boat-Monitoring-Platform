import { lazy, Suspense } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Activity, Archive, ArrowDownToLine, ArrowUpRight, CheckCheck, CircleCheck, Clock3, Inbox, LoaderCircle, MessageSquare, RotateCcw, ScanSearch, Send, Ship, UserRoundCheck, UsersRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { date, label } from '../Complaints/complaintApi';
import { CaseKindBadge, LoadState, StatusBadge } from '../Complaints/ComplaintComponents';
import { useComplaintData } from '../Complaints/useComplaintData';
import type { AnalyticsInterval, MonitoringAnalytics } from './analyticsApi';
import { caseDateParams, exportAnalytics, localToday, moveDay } from './analyticsApi';
import AnalyticsControls from './AnalyticsControls';

const Charts = lazy(() => import('./AnalyticsCharts'));
const isoDay = (value: string | null) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
const workflow: Record<string, { color: string; icon: LucideIcon }> = {
  Submitted: { color: '#c19342', icon: Inbox }, UnderReview: { color: '#6876c2', icon: ScanSearch }, Forwarded: { color: '#b98543', icon: Send },
  Acknowledged: { color: '#7497b2', icon: CheckCheck }, InProgress: { color: '#7971c8', icon: LoaderCircle }, Responded: { color: '#578ea0', icon: MessageSquare },
  Resolved: { color: '#4c9883', icon: CircleCheck }, Closed: { color: '#9aabb7', icon: Archive }, Reopened: { color: '#b86e69', icon: RotateCcw },
};

export default function SltdaDashboard() {
  const [params, setParams] = useSearchParams();
  const today = localToday();
  const from = isoDay(params.get('from')) ? params.get('from')! : moveDay(today, -29);
  const to = isoDay(params.get('to')) ? params.get('to')! : today;
  const interval: AnalyticsInterval = params.get('interval') === 'weekly' ? 'weekly' : params.get('interval') === 'monthly' ? 'monthly' : 'daily';
  const state = useComplaintData<MonitoringAnalytics>(`/api/passenger-monitoring/analytics?${new URLSearchParams({ from, to, interval })}`, true);
  const d = state.data;
  const period = new URLSearchParams({ from, to }).toString();
  const casePath = (filters: Record<string, string> = {}) => `/sltda/complaints?${new URLSearchParams({ ...caseDateParams(from, to), ...filters })}`;
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"><Activity size={13} className="text-indigo-500" />Tourism operations / Overview</p><h1 className="mt-2 text-[27px] font-semibold tracking-tight sm:text-[30px]">Passenger activity</h1><p className="mt-2 text-[13px] text-slate-500">A clear view of registrations, journeys, and passenger cases.</p></div>
      <button type="button" disabled={!d || !!state.error} onClick={() => d && exportAnalytics(d)} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"><ArrowDownToLine size={15} />Export summary</button></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><AnalyticsControls key={`${from}:${to}`} from={from} to={to} interval={interval} onChange={(first, last, grain) => setParams({ from: first, to: last, interval: grain })} />
      <p className="flex items-center gap-1.5 text-[10px] text-slate-400"><span className={`h-1.5 w-1.5 rounded-full ${state.error ? 'bg-amber-500' : 'bg-emerald-500'}`} />{d ? `${state.error ? 'Last available data' : 'Updated'} ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' }).format(new Date(d.asOfUtc))} · Sri Lanka time` : 'Connecting to live records'}</p></div>
    {state.error && <LoadState loading={false} error={state.error} reload={state.reload} />}
    {!d && state.loading && <DashboardSkeleton />}
    {d && <>
      <section aria-label="Live monitoring statistics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric title="Total passengers" value={d.totals.totalPassengers} note="Unique profiles across all operators" scope="All time" to="/sltda/passengers" icon={UsersRound} color="teal" />
        <Metric title="New registrations" value={d.totals.newPassengers} note="New passenger profiles in this period" scope="This period" to={`/sltda/passengers?${period}`} icon={UserRoundCheck} color="indigo" />
        <Metric title="Registered trips" value={d.totals.trips} note={`${d.totals.completedTrips.toLocaleString()} completed · scheduled in this period`} scope="This period" to={`/sltda/trips?${period}`} icon={Ship} color="sky" />
        <Metric title="Open cases" value={d.totals.openCases} note="Cases awaiting resolution or closure" scope="This period" to={casePath({ queue: 'open' })} icon={Clock3} color="amber" />
      </section>
      <Suspense fallback={<ChartSkeleton />}><Charts key={`${from}:${to}:${interval}`} data={d} /></Suspense>
      <div className="grid items-start gap-5 xl:grid-cols-[1.35fr_1fr]">
        <section className="sltda-panel overflow-hidden" aria-labelledby="recent-cases-heading"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6"><div><h2 id="recent-cases-heading" className="text-sm font-semibold">Recent passenger cases</h2><p className="mt-1 text-xs text-slate-500">Latest submissions within your reporting period</p></div><Link to={casePath()} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600">View all cases<ArrowUpRight size={13} /></Link></div>
          {d.recentCases.length ? <div className="overflow-x-auto"><table className="w-full min-w-[570px] text-left text-xs"><thead className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-400"><tr><th scope="col" className="px-5 py-3 font-medium sm:px-6">Case / passenger</th><th scope="col" className="px-3 py-3 font-medium">Type</th><th scope="col" className="px-3 py-3 font-medium">Status</th><th scope="col" className="px-5 py-3 text-right font-medium">Submitted</th></tr></thead><tbody className="divide-y divide-slate-100">{d.recentCases.map(c => <tr key={c.id} className="hover:bg-slate-50/60"><td className="max-w-[230px] px-5 py-4 sm:px-6"><Link to={`/sltda/complaints/${c.id}`} aria-label={c.reference} title={c.reference} className="block truncate font-semibold text-slate-700 hover:text-indigo-600">{c.type}</Link><Link to={`/sltda/passengers/${c.passengerId}`} className="mt-1.5 block truncate text-[11px] text-slate-400 hover:text-indigo-600">{c.passengerName}</Link></td><td className="px-3 py-4"><CaseKindBadge value={c.kind} /></td><td className="px-3 py-4"><StatusBadge value={c.status} /></td><td className="whitespace-nowrap px-5 py-4 text-right text-[10px] text-slate-500">{date(c.createdAtUtc)}</td></tr>)}</tbody></table></div> : <div className="px-6 py-14 text-center"><Inbox size={25} strokeWidth={1.3} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-medium text-slate-500">No cases submitted in this period</p><p className="mt-1 text-xs text-slate-400">Try a wider date range to review earlier activity.</p></div>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-[10px] text-slate-400 sm:px-6"><span>Showing {d.recentCases.length} of {d.totals.cases} cases</span><span>Latest submissions first</span></div>
        </section>
        <section className="sltda-panel p-5 sm:p-6" aria-labelledby="case-status-heading"><h2 id="case-status-heading" className="text-sm font-semibold">Case status</h2><p className="mt-1.5 text-xs text-slate-500">Current state of cases submitted in this period</p>
          <div className="mt-5 grid grid-cols-2 gap-3"><Link to={casePath({ queue: 'open' })} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3"><p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800"><Clock3 size={13} />Open</p><strong className="mt-2 block text-2xl font-semibold tabular-nums tracking-tight">{d.totals.openCases}</strong></Link>
            <Link to={casePath({ queue: 'completed' })} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3"><p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800"><CircleCheck size={13} />Resolved / closed</p><strong className="mt-2 block text-2xl font-semibold tabular-nums tracking-tight">{d.totals.resolved + d.totals.closed}</strong></Link></div>
          {d.totals.cases > 0 && <><div aria-hidden="true" className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full">{d.statusDistribution.filter(s => s.count > 0).map(s => <span key={s.status} style={{ width: `${s.count / d.totals.cases * 100}%`, backgroundColor: workflow[s.status]?.color ?? '#94a3b8' }} />)}</div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">{d.statusDistribution.filter(s => s.count > 0).map(s => { const style = workflow[s.status] ?? { icon: Inbox, color: '#94a3b8' }; const Icon = style.icon; return <Link key={s.status} to={casePath({ status: s.status })} className="flex min-h-9 items-center justify-between gap-2 rounded-md px-1 text-[11px] text-slate-500 hover:bg-slate-50"><span className="flex items-center gap-1.5"><Icon size={13} style={{ color: style.color }} />{label(s.status)}</span><strong className="font-medium tabular-nums text-slate-700">{s.count}</strong></Link>; })}</div></>}
          <div className="mt-4 space-y-1 border-t border-slate-100 pt-3">{[
            { name: 'Awaiting review', count: d.totals.awaitingReview, queue: 'awaiting-review', icon: ScanSearch },
            { name: 'Awaiting acknowledgment', count: d.totals.awaitingAcknowledgment, queue: 'awaiting-ack', icon: Send },
            { name: 'Awaiting authority responses', count: d.totals.awaitingResponses, queue: 'awaiting-response', icon: MessageSquare },
          ].map(q => <Link key={q.queue} to={casePath({ queue: q.queue })} className="flex min-h-9 items-center justify-between gap-2 rounded-lg px-1 text-[11px] text-slate-500 hover:bg-slate-50"><span className="flex items-center gap-2"><q.icon size={13} className="text-slate-400" />{q.name}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium tabular-nums text-slate-600">{q.count}</span></Link>)}</div><p className="mt-3 text-[10px] leading-4 text-slate-400">Queues can overlap. Pending acknowledgment is included in awaiting responses.</p>
        </section>
      </div>
    </>}
  </main>;
}

function Metric({ title, value, note, scope, to, icon: Icon, color }: { title: string; value: number; note: string; scope: string; to: string; icon: LucideIcon; color: 'teal' | 'indigo' | 'sky' | 'amber' }) {
  const reduced = useReducedMotion();
  const colors = { teal: { icon: 'bg-teal-50 text-teal-600', border: 'hover:border-teal-200', line: 'bg-teal-400' }, indigo: { icon: 'bg-indigo-50 text-indigo-600', border: 'hover:border-indigo-200', line: 'bg-indigo-400' }, sky: { icon: 'bg-sky-50 text-sky-600', border: 'hover:border-sky-200', line: 'bg-sky-400' }, amber: { icon: 'bg-amber-50 text-amber-700', border: 'hover:border-amber-200', line: 'bg-amber-400' } }[color];
  return <motion.div initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }}><Link to={to} aria-label={`${title}: ${value}. View records`} className={`sltda-metric sltda-panel group relative block h-full overflow-hidden p-5 ${colors.border}`}><div className="flex items-center justify-between gap-2"><span className={`grid h-9 w-9 place-items-center rounded-xl ${colors.icon}`}><Icon size={18} strokeWidth={1.7} /></span><span className="flex items-center gap-2 text-[10px] text-slate-400">{scope}<ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span></div><p className="mt-4 text-xs font-medium text-slate-500">{title}</p><strong className="mt-1.5 block text-[31px] font-semibold leading-tight tabular-nums tracking-tight">{value.toLocaleString()}</strong><p className="mt-2 text-[10px] leading-4 text-slate-400">{note}</p><span className={`absolute bottom-0 left-5 right-5 h-0.5 opacity-45 ${colors.line}`} /></Link></motion.div>;
}

function ChartSkeleton() {
  return <div className="grid gap-5 xl:grid-cols-2" aria-hidden="true">{[0, 1].map(n => <div key={n} className="sltda-panel h-[385px] p-6"><div className="sltda-skeleton h-4 w-40 rounded bg-slate-100" /><div className="sltda-skeleton mt-6 h-64 rounded-xl bg-slate-50" /></div>)}</div>;
}

function DashboardSkeleton() {
  return <div role="status" aria-label="Loading analytics" className="space-y-5"><span className="sr-only">Loading analytics from live records…</span><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map(n => <div key={n} className="sltda-panel h-[190px] p-5"><div className="sltda-skeleton h-9 w-9 rounded-xl bg-slate-100" /><div className="sltda-skeleton mt-4 h-3 w-24 rounded bg-slate-100" /><div className="sltda-skeleton mt-3 h-7 w-16 rounded bg-slate-100" /></div>)}</div><ChartSkeleton /></div>;
}
