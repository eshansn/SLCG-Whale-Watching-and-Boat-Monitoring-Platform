import { useContext } from 'react';
import { PassengerLocaleContext } from './context';

export function usePassengerLocale() {
  const context = useContext(PassengerLocaleContext);
  if (!context) throw new Error('Passenger locale requires the passenger route provider.');
  return context;
}
