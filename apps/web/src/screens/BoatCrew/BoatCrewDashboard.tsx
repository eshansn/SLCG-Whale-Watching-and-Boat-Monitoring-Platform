import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CircleAlert, Clock3, Ship } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useOperations } from '../../operations/useOperations';
import { crewApi, type CrewProfile } from './crewApi';
import { CrewLayout, State, Status } from './components/CrewLayout';

export default function BoatCrewDashboard() {
  const nav = useNavigate();
  const { session } = useAuth();
  const { boats, trips, loading, error } = useOperations();
  const [profile, setProfile] = useState<CrewProfile>();
  const [photo, setPhoto] = useState<string>();

  useEffect(() => {
    if (!session) return;
    crewApi.profile(session.accessToken).then(profile => {
      setProfile(profile);
      if (profile.hasProfilePhoto) void crewApi.photo(session.accessToken).then(setPhoto);
    }).catch(() => undefined);
  }, [session]);

  const sorted = useMemo(() => [...trips].sort((a, b) => +new Date(a.scheduledDepartureUtc) - +new Date(b.scheduledDepartureUtc)), [trips]);
  const ongoing = sorted.find(trip => trip.status === 'Ongoing');
  const upcoming = sorted.filter(trip => !['Ongoing', 'Completed', 'Cancelled'].includes(trip.status));

  return <CrewLayout>{loading ? <div className="mx-auto max-w-2xl px-4 py-8"><State>Loading assignments…</State></div> : error ? <div className="mx-auto max-w-2xl px-4 py-8"><State tone="error">{error}</State></div> : <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-3 sm:px-6 sm:pt-5">
    <section className="mb-5 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/75 p-3 shadow-[0_8px_25px_rgba(15,23,42,.06)] backdrop-blur">
      {photo ? <img src={photo} className="h-16 w-16 rounded-2xl object-cover ring-2 ring-blue-100" alt="Profile"/> : <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-100 to-slate-100 text-xl font-bold text-[#162d54]">{profile?.displayName.charAt(0) ?? 'C'}</div>}
      <div>
        <p className="text-[9px] font-medium uppercase tracking-[.14em] text-slate-400">Welcome back</p>
        <h1 className="mt-0.5 text-base font-bold tracking-tight">{profile?.displayName ?? session?.email}</h1>
        <div className="mt-1"><Status value={profile?.certified ? 'Approved' : 'Pending'}/></div>
      </div>
    </section>

    {ongoing ? <button onClick={() => nav(`/crew/trip-info/${ongoing.id}`)} className="group relative w-full overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0876ee] via-[#075adf] to-[#12348c] p-5 text-left text-white shadow-[0_14px_30px_rgba(18,52,140,.28)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(18,52,140,.34)]">
      <span className="absolute -right-8 -top-12 h-36 w-36 rounded-full bg-white/10"/>
      <div className="relative flex items-center justify-between"><span className="text-sm font-medium">Ongoing Trip</span><span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15"><Ship size={18}/></span></div>
      <p className="relative mt-7 text-base font-bold">{ongoing.vesselName}</p>
      <p className="relative mt-0.5 text-[10px] text-white/75">{ongoing.registrationNumber}</p>
      <div className="relative mt-5 flex items-center justify-between border-t border-white/15 pt-3 text-[10px] text-blue-50"><span>Trip currently underway</span><CircleAlert size={16} className="transition group-hover:scale-110"/></div>
    </button> : <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#162d54] to-[#214877] p-5 text-white shadow-[0_14px_28px_rgba(22,45,84,.2)]">
      <Ship className="absolute -bottom-5 -right-3 h-24 w-24 rotate-[-12deg] text-white/10"/>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10"><Ship size={18}/></span>
      <p className="relative mt-5 max-w-sm text-sm font-semibold leading-5">No trip on deck — the ocean says you’ve earned a tea break!</p>
      <p className="relative mt-1 text-[10px] text-white/65">Your next active assignment will sail in here.</p>
    </div>}

    <div className="mb-3 mt-7 flex items-center justify-between"><h2 className="text-base font-bold">Upcoming Trips</h2><span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-bold text-blue-700">{upcoming.length} scheduled</span></div>
    {upcoming.length === 0 ? <State>No upcoming trips assigned.</State> : <div className="space-y-3">{upcoming.map(trip => {
      const boat = boats.find(candidate => candidate.id === trip.boatId);
      const departure = new Date(trip.scheduledDepartureUtc);
      return <article key={trip.id} className="rounded-[20px] border border-slate-200/80 bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,.08)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,.11)]">
        <div className="grid grid-cols-[1fr_118px] gap-3 sm:grid-cols-[1fr_150px]">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Boat</p>
            <p className="mt-0.5 truncate text-sm font-bold">{trip.vesselName}</p>
            <div className="mt-3 space-y-1.5 text-[10px] text-slate-500"><p className="flex items-center gap-1.5"><CalendarDays size={12} className="text-blue-500"/>{departure.toLocaleDateString('en-LK', { day: '2-digit', month: 'short' })}</p><p className="flex items-center gap-1.5"><Clock3 size={12} className="text-blue-500"/>{departure.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit' })}</p></div>
            <div className="mt-2"><Status value={trip.shoreApproval}/></div>
          </div>
          {boat?.imageUrl ? <img src={boat.imageUrl} alt={boat.name} className="h-[112px] w-full rounded-2xl object-cover"/> : <div className="flex h-[112px] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-slate-100"><Ship className="text-blue-300"/></div>}
        </div>
        <button onClick={() => nav(`/crew/trip-info/${trip.id}`)} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#162d54] py-2.5 text-[10px] font-semibold text-white transition hover:bg-[#203d6c]">Trip information <CircleAlert size={13}/></button>
      </article>;
    })}</div>}
  </div>}</CrewLayout>;
}
