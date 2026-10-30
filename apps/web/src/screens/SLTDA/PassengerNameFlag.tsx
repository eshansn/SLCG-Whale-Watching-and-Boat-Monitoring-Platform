import { Globe2 } from 'lucide-react';
import { CountryFlag } from '../../components/CountryFlag';
import { countries, findCountry } from '../../data/countries';

export default function PassengerNameFlag({ countryCode }: { countryCode?: string | null }) {
  const value = countryCode?.trim();
  const country = findCountry(value) ?? countries.find(country => country.name.toLowerCase() === value?.toLowerCase());
  return country ? <CountryFlag countryCode={country.code} /> :
    <Globe2 size={18} className="shrink-0 text-slate-400" role="img" aria-label="Country not recorded" />;
}
