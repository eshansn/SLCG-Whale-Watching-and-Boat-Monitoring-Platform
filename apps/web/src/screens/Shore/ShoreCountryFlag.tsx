import { findCountry } from '../../data/countries';

// Shore's flags are served with the app so the manifest does not depend on a CDN.
// Artwork attribution/license: /shore-flags/ATTRIBUTION.txt.
export function ShoreCountryFlag({ countryCode }: { countryCode?: string }) {
  const country = findCountry(countryCode);
  if (!country) return null;
  return <img src={`/shore-flags/${country.code}.svg`} alt={`${country.name} flag`} aria-label={`${country.name} flag`}
    title={country.name} width={24} height={18}
    className="inline-block h-[18px] w-6 shrink-0 rounded-[2px] object-cover shadow-sm ring-1 ring-black/10" />;
}
