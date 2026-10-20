import PassengerLanguageSelector from './i18n/PassengerLanguageSelector';
import { usePassengerLocale } from './i18n/usePassengerLocale';
import { useEffect, useState } from 'react';
import { Anchor, CalendarDays, Clock3, IdCard, LogIn, Ship, UserPlus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPassengerTrip, type PassengerTripPreview } from './passengerTripApi';
import { activatePassengerTrip } from './store/passengerStorage';

export default function PassengerTripLandingPage() {
  const { t, locale, displayValue, translateMessage } = usePassengerLocale();
  const { invitationCode = '' } = useParams<{ invitationCode: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<PassengerTripPreview>();
  const [error, setError] = useState('');

  useEffect(() => {
    getPassengerTrip(invitationCode).then((preview) => {
      activatePassengerTrip(invitationCode);
      setTrip(preview);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "tripLoadFailed"));
  }, [invitationCode]);

  if (error) return <main className="relative grid min-h-screen place-items-center bg-[#111827] p-6 text-white"><PassengerLanguageSelector /><section className="max-w-md rounded-2xl bg-white/10 p-8 text-center"><Anchor className="mx-auto" size={42}/><h1 className="mt-4 text-2xl font-bold">{t('invitationUnavailable')}</h1><p className="mt-3 text-white/70">{translateMessage(error)}</p></section></main>;
  if (!trip) return <main className="relative grid min-h-screen place-items-center bg-[#111827] text-white"><PassengerLanguageSelector />{t('validatingInvitation')}</main>;

  const scheduled = new Date(trip.scheduledDepartureUtc);
  return <main className="relative min-h-screen bg-[#111827] p-5 text-white sm:p-8">
    <section className="mx-auto w-full max-w-2xl overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
      <header className="bg-[#162d54] p-7 text-white sm:p-9"><div className="flex flex-wrap items-center gap-3 text-sm text-white/70"><Ship size={20}/><span>{t('tripInvitation')}</span><PassengerLanguageSelector inline /></div><h1 className="mt-4 text-3xl font-bold">{trip.boatName}</h1><p className="mt-1 font-mono text-sm text-white/70">{trip.registrationNumber}</p></header>
      <div className="p-7 sm:p-9">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail icon={<CalendarDays/>} label={t('scheduledDate')} value={new Intl.DateTimeFormat(locale,{dateStyle:'full'}).format(scheduled)}/>
          <Detail icon={<Clock3/>} label={t('scheduledTime')} value={new Intl.DateTimeFormat(locale,{timeStyle:'short'}).format(scheduled)}/>
          <Detail icon={<Anchor/>} label={t('tripStatus')} value={displayValue(trip.status)}/>
          <Detail icon={<IdCard/>} label={t('tripStatus')} value={displayValue(trip.status)}/>
        </dl>
        {!trip.acceptingPassengers ? <p className="mt-7 rounded-xl bg-amber-50 p-4 text-sm font-medium text-amber-800">{t('registrationClosed')}</p> : <div className="mt-8"><h2 className="text-xl font-semibold">{t('continuePortal')}</h2><p className="mt-1 text-sm text-slate-500">{t('identifyDescription')}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><button onClick={() => navigate(`/passenger/register?trip=${encodeURIComponent(invitationCode)}`)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#162d54] px-5 font-semibold text-white"><UserPlus size={19}/>{t('newPassenger')}</button><button onClick={() => navigate(`/passenger/verification?trip=${encodeURIComponent(invitationCode)}`)} className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-[#162d54] px-5 font-semibold text-[#162d54]"><LogIn size={19}/>{t('returningPassenger')}</button></div></div>}
      </div>
    </section>
  </main>;
}

function Detail({icon,label,value}:{icon:React.ReactNode;label:string;value:string}) { return <div className="flex gap-3 rounded-xl bg-slate-50 p-4"><span className="text-[#162d54]">{icon}</span><div><dt className="text-xs font-semibold uppercase text-slate-400">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div></div>; }
