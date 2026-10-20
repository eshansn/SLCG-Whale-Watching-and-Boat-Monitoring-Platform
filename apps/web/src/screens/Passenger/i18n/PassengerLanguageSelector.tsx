import { Languages } from 'lucide-react';
import { passengerLanguages, resolvePassengerLanguage } from './locale';
import { usePassengerLocale } from './usePassengerLocale';

export default function PassengerLanguageSelector({ inline = false }: { inline?: boolean }) {
  const { locale, t, setLanguage } = usePassengerLocale();
  return <label className={`${inline ? 'ml-auto' : 'absolute right-3 top-3 z-40 sm:right-5 sm:top-5'} inline-flex max-w-[calc(100%-24px)] shrink-0 items-center gap-1.5 rounded-lg border border-white/20 bg-black/70 px-2 py-1.5 font-poppins text-xs text-white`}>
    <Languages size={15} aria-hidden="true" />
    <span className="sr-only">{t('language')}</span>
    <select aria-label={t('language')} value={locale} onChange={event => setLanguage(resolvePassengerLanguage(event.target.value))} className="min-w-0 cursor-pointer bg-transparent py-1 text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-[#5cefdc]">
      {passengerLanguages.map(({ code, name }) => <option key={code} value={code} lang={code} className="bg-black text-white">{name}</option>)}
    </select>
  </label>;
}
