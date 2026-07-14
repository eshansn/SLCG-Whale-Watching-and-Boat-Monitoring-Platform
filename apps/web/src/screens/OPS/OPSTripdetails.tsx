import { ArrowLeft, CheckCircle2, Clock3, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import VesselMap from './components/VesselMap';

type ApprovalState = 'Approved' | 'Pending';

interface Person {
  id: string;
  name: string;
  nicOrPassport: string;
  age?: number;
  nationality?: string;
  role?: string;
  confirmed: boolean;
}

const passengers: Person[] = [
  { id: 'P-101', name: 'Nethmi Jayasuriya', nicOrPassport: '200173402811', age: 24, nationality: 'Sri Lankan', confirmed: true },
  { id: 'P-102', name: 'Aarav Patel', nicOrPassport: 'N8420157', age: 31, nationality: 'Indian', confirmed: true },
  { id: 'P-103', name: 'Sophie Laurent', nicOrPassport: '22FV94812', age: 29, nationality: 'French', confirmed: true },
  { id: 'P-104', name: 'Noah Williams', nicOrPassport: '588214907', age: 35, nationality: 'British', confirmed: false },
];

const crew: Person[] = [
  { id: 'C-201', name: 'Malith Perera', nicOrPassport: '901452671V', role: 'Captain', confirmed: true },
  { id: 'C-202', name: 'Sahan Fernando', nicOrPassport: '951340228V', role: 'Deckhand', confirmed: true },
  { id: 'C-203', name: 'Tharindu Silva', nicOrPassport: '972341166V', role: 'Guide', confirmed: true },
  { id: 'C-204', name: 'Kasun Jayawardena', nicOrPassport: '882931540V', role: 'Engineer', confirmed: true },
];

const approvalItems: Array<{ label: string; state: ApprovalState }> = [
  { label: 'Coast Guard clearance', state: 'Approved' },
  { label: 'Passenger manifest', state: 'Approved' },
  { label: 'Safety inspection', state: 'Pending' },
];

function StatusPill({ confirmed }: { confirmed: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
      confirmed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }`}>
      {confirmed ? 'Confirmed' : 'Pending'}
    </span>
  );
}

function SectionCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-sm font-bold text-[#14223d]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function OPSTripdetails() {
  const navigate = useNavigate();
  const { tripId = '1' } = useParams();
  const [search, setSearch] = useState('');
  const [actionNote, setActionNote] = useState('Vessel contacted. OPS team monitoring the trip route.');

  const visiblePassengers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return passengers;
    return passengers.filter((passenger) =>
      [passenger.name, passenger.nicOrPassport, passenger.nationality]
        .some((value) => value?.toLowerCase().includes(query)));
  }, [search]);

  return (
    <div className="min-h-screen bg-[#eef2f6] font-[Poppins] text-[#14223d]">
      <header className="border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm sm:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/ops/trips')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
            Back to trips
          </button>
          <img src="/SLCG.png" alt="Sri Lanka Coast Guard" className="h-10 w-auto object-contain sm:h-12" />
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-8 sm:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Trip #{tripId}</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Live trip overview</h1>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Vessel underway
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_260px]">
          <SectionCard title="Vessel information" className="xl:row-span-2">
            <img src="/Hero.png" alt="FV Mirissa King whale watching vessel" className="h-44 w-full object-cover object-left" />
            <div className="space-y-5 p-5">
              <div>
                <h2 className="text-xl font-bold">FV Mirissa King</h2>
                <p className="mt-1 text-xs text-slate-500">Registration SL-WB-204</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-xs">
                {[
                  ['Owner', 'Mirissa Ocean Tours'],
                  ['Vessel type', 'Passenger vessel'],
                  ['Length', '18.5 m'],
                  ['Capacity', '42 persons'],
                  ['Departure', '06:30 AM'],
                  ['Expected return', '12:30 PM'],
                  ['Last GPS', '20 sec ago'],
                  ['Speed', '12.4 knots'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-400">{label}</dt>
                    <dd className="mt-1 font-semibold text-slate-700">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-xl bg-slate-50 p-4 text-xs">
                <p className="font-semibold text-slate-700">Current coordinates</p>
                <p className="mt-1 font-mono text-slate-500">5.949186, 80.438509</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Passengers">
            <div className="border-b border-slate-100 p-4">
              <label className="relative block max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search passengers"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs outline-none transition focus:border-cyan-500 focus:bg-white"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">NIC / Passport</th>
                    <th className="px-5 py-3 font-medium">Age</th>
                    <th className="px-5 py-3 font-medium">Nationality</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiblePassengers.map((passenger) => (
                    <tr key={passenger.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 font-semibold">{passenger.name}</td>
                      <td className="px-5 py-3.5 text-slate-500">{passenger.nicOrPassport}</td>
                      <td className="px-5 py-3.5 text-slate-500">{passenger.age}</td>
                      <td className="px-5 py-3.5 text-slate-500">{passenger.nationality}</td>
                      <td className="px-5 py-3.5"><StatusPill confirmed={passenger.confirmed} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="space-y-5 xl:row-span-2">
            <SectionCard title="Approvals">
              <div className="space-y-3 p-4">
                {approvalItems.map((approval) => (
                  <div key={approval.label} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-slate-600">{approval.label}</span>
                    <span className={`inline-flex items-center gap-1 font-bold ${
                      approval.state === 'Approved' ? 'text-emerald-600' : 'text-amber-600'
                    }`}>
                      {approval.state === 'Approved' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}
                      {approval.state}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Emergencies">
              <div className="p-4">
                <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-3">
                  <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                  <div>
                    <p className="text-xs font-bold text-emerald-700">No active emergency</p>
                    <p className="mt-1 text-[11px] leading-5 text-emerald-700/70">All vessel signals are operating normally.</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                  <TriangleAlert size={14} className="text-amber-500" />
                  Last SOS test: 05:58 AM
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Action taken">
              <div className="p-4">
                <textarea
                  value={actionNote}
                  onChange={(event) => setActionNote(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 outline-none focus:border-cyan-500 focus:bg-white"
                />
                <button type="button" className="mt-3 w-full rounded-xl bg-[#ef3340] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#d92532]">
                  Save action note
                </button>
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
            <SectionCard title="Crew">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-medium">Name</th>
                      <th className="px-5 py-3 font-medium">NIC</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {crew.map((member) => (
                      <tr key={member.id}>
                        <td className="px-5 py-3.5 font-semibold">{member.name}</td>
                        <td className="px-5 py-3.5 text-slate-500">{member.nicOrPassport}</td>
                        <td className="px-5 py-3.5 text-slate-500">{member.role}</td>
                        <td className="px-5 py-3.5"><StatusPill confirmed={member.confirmed} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard title="Live vessel location">
              <div className="h-[300px] p-3">
                <VesselMap />
              </div>
            </SectionCard>
          </div>
        </div>
      </main>
    </div>
  );
}
