import type { AttendancePassenger } from './shoreAttendanceApi';
import { summarizeShorePassengers } from './shorePassengerPresentation';

export default function ShorePassengerSummary({ passengers, loading }: { passengers?: AttendancePassenger[]; loading: boolean }) {
  const counts = summarizeShorePassengers(passengers ?? []);
  const rows = [['Local', counts.local], ['Foreign', counts.foreign],
    ...(counts.unrecorded.total ? [['Not recorded', counts.unrecorded] as const] : []), ['Grand Total', counts.total]] as const;
  return <section aria-labelledby="shore-departure-summary-title" aria-busy={loading} className="min-w-0 overflow-hidden rounded-xl border border-[#8ca9b92e] bg-[linear-gradient(145deg,#062b40,#041726)] text-[#eafbff] shadow-[inset_0_1px_0_#8af5ff1a,0_10px_30px_#00000024]">
    <div className="border-b border-[#8ca9b92e] px-4 py-5 sm:px-6">
      <h2 id="shore-departure-summary-title" className="text-lg font-semibold tracking-tight text-[#eafbff]">Passenger Summary</h2>
    </div>
    <div className="overflow-x-auto" role="region" aria-label="Passenger summary table" tabIndex={0}>
      <table className="w-full text-left text-xs sm:text-sm">
        <caption className="sr-only">Onboard passengers verified as present, by nationality category and recorded age category</caption>
        <thead className="border-b border-[#8ca9b92e] bg-[#04172680] text-[#8ca9b9]"><tr>
          <th scope="col" className="px-3 py-3 sm:px-5">Passenger Category</th>
          {['Adults', 'Children', 'Under 6', ...(counts.total.unknown ? ['Not recorded'] : []), 'Total'].map(label => <th scope="col" key={label} className="px-2 py-3 text-center sm:px-4">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-[#8ca9b926]">{rows.map(([label, row]) => <tr key={label} className={label === 'Grand Total' ? 'bg-[#8af5ff14] font-bold text-[#8af5ff]' : 'text-[#eafbff]'}>
          <th scope="row" className="px-3 py-4 sm:px-5">{label}</th>
          {[row.adult, row.child, row.small, ...(counts.total.unknown ? [row.unknown] : []), row.total].map((value, index) => <td key={index} className="px-2 py-4 text-center tabular-nums sm:px-4">{passengers ? value : '—'}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
    {counts.specialNeeds > 0 && <p className="px-4 py-4 text-xs leading-5 text-[#8ca9b9] sm:px-6">Special needs passengers are counted as adults, consistent with existing system totals.</p>}
    {(counts.total.unknown > 0 || counts.unrecorded.total > 0) && <p className="px-4 pb-4 pt-3 text-xs leading-5 text-[#fcd68a] sm:px-6">Missing classifications are shown as Not recorded and included in totals; ages and nationalities are not guessed.</p>}
  </section>;
}
