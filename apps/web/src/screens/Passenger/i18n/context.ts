import { createContext } from 'react';
import type { createPassengerLocale, PassengerLanguage } from './locale';

export const PassengerLocaleContext = createContext<(ReturnType<typeof createPassengerLocale> & {
  setLanguage: (language: PassengerLanguage) => void;
}) | null>(null);
