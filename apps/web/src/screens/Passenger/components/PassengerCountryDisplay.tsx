import { CountryFlag } from '../../../components/CountryFlag';
import { findCountry } from '../../../data/countries';
import { usePassengerLocale } from '../i18n/usePassengerLocale';

export function PassengerCountryDisplay({ passengerType, countryCode }: { passengerType: string; countryCode?: string }) {
  const { t, countryName } = usePassengerLocale();
  const isLocal = passengerType.toLowerCase() === 'local';
  const country = findCountry(isLocal ? 'LK' : countryCode);
  const typeLabel = t(isLocal ? 'local' : 'foreign');
  const name = country ? countryName(country.code, country.name) : '';
  return <span className="inline-flex items-center gap-1.5">
    <CountryFlag countryCode={country?.code} label={name} flagLabel={t('flag', { country: name })} />
    <span>{country ? `${typeLabel} · ${name}` : typeLabel}</span>
  </span>;
}
