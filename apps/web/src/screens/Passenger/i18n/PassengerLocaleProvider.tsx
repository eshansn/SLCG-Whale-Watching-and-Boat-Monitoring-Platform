import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PassengerLocaleContext } from './context';
import { createPassengerLocale, readPassengerLanguage, resolvePassengerLanguage, savePassengerLanguage, type PassengerLanguage } from './locale';
import './passengerLocale.css';

export default function PassengerLocaleProvider() {
  const [language, setLanguageState] = useState(readPassengerLanguage);
  const value = useMemo(() => ({
    ...createPassengerLocale(language),
    setLanguage: (selection: PassengerLanguage) => {
      const next = resolvePassengerLanguage(selection);
      setLanguageState(next);
      savePassengerLanguage(next);
    },
  }), [language]);

  useEffect(() => {
    const previousTitle = document.title;
    const previousLanguage = document.documentElement.lang;
    document.title = value.t('platform');
    document.documentElement.lang = language;
    return () => {
      document.title = previousTitle;
      document.documentElement.lang = previousLanguage;
    };
  }, [language, value]);

  return <PassengerLocaleContext.Provider value={value}>
    <div lang={language} className="passenger-locale contents"><Outlet /></div>
  </PassengerLocaleContext.Provider>;
}
