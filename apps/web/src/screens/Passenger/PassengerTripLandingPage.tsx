import { useEffect, useState } from 'react';
import { Anchor, CalendarDays, Clock3, IdCard, LogIn, Ship, UserPlus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPassengerTrip, type PassengerTripPreview } from './passengerTripApi';
import { activatePassengerTrip } from './store/passengerStorage';

export default function PassengerTripLandingPage() {
  const { invitationCode = '' } = useParams<{ invitationCode: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<PassengerTripPreview>();
  const [error, setError] = useState('');

  useEffect(() => {
    getPassengerTrip(invitationCode).then((preview) => {
      activatePassengerTrip(invitationCode);
      setTrip(preview);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Unable to load trip.'));
  }, [invitationCode]);

  if (error) return <main className="grid min-h-screen place-items-center bg-[#111827] p-6 text-white"><section className="max-w-md rounded-2xl bg-white/10 p-8 text-center"><Anchor className="mx-auto" size={42}/><h1 className="mt-4 text-2xl font-bold">Invitation unavailable</h1><p className="mt-3 text-white/70">{error}</p></section></main>;
  if (!trip) return <main className="grid min-h-screen place-items-center bg-[#111827] text-white">Validating trip invitation...</main>;

  const scheduled = new Date(trip.scheduledDepartureUtc);
  return <main className="min-h-screen bg-[#111827] p-5 text-white sm:p-8">
    <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
      <header className="bg-[#162d54] p-7 text-white sm:p-9"><div className="flex items-center gap-3 text-sm text-white/70"><Ship size={20}/><span>Whale Watching Trip Invitation</span></div><h1 className="mt-4 text-3xl font-bold">{trip.boatName}</h1><p className="mt-1 font-mono text-sm text-white/70">{trip.registrationNumber}</p></header>
      <div className="p-7 sm:p-9">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail icon={<CalendarDays/>} label="Scheduled date" value={new Intl.DateTimeFormat('en-LK',{dateStyle:'full'}).format(scheduled)}/>
          <Detail icon={<Clock3/>} label="Scheduled time" value={new Intl.DateTimeFormat('en-LK',{timeStyle:'short'}).format(scheduled)}/>
          <Detail icon={<Anchor/>} label="Trip status" value={trip.status}/>
          <Detail icon={<IdCard/>} label="Shore approval" value={trip.shoreApproval}/>
        </dl>
        {!trip.acceptingPassengers ? <p className="mt-7 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">This trip is no longer accepting passenger registrations.</p> : <div className="mt-8"><h2 className="text-xl font-semibold">Continue to passenger portal</h2><p className="mt-1 text-sm text-slate-500">Register for the first time or identify yourself using your existing passenger record.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => navigate(`/passenger/register?trip=${encodeURIComponent(invitationCode)}`)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#162d54] px-5 font-semibold text-white"><UserPlus size={19}/>New passenger</button><button onClick={() => navigate(`/passenger/verification?trip=${encodeURIComponent(invitationCode)}`)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[#162d54] px-5 font-semibold text-[#162d54]"><LogIn size={19}/>Returning passenger</button></div></div>}
      </div>
    </section>
  </main>;
}

function Detail({icon,label,value}:{icon:React.ReactNode;label:string;value:string}) { return <div className="flex gap-3 rounded-xl bg-slate-50 p-4"><span className="text-[#162d54]">{icon}</span><div><dt className="text-xs font-semibold uppercase text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div></div>; }
