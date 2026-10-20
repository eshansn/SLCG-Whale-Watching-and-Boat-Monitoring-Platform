import ReactCountryFlag from "react-country-flag";
import { findCountry } from "../data/countries";

interface CountryFlagProps {
  countryCode?: string;
  large?: boolean;
  label?: string;
  flagLabel?: string;
}

export function CountryFlag({ countryCode, large = false, label, flagLabel }: CountryFlagProps) {
  const country = findCountry(countryCode);
  if (!country) return null;

  return (
    <ReactCountryFlag
      countryCode={country.code}
      svg
      title={label ?? country.name}
      aria-label={flagLabel ?? `${country.name} flag`}
      className="inline-block shrink-0 rounded-[2px] object-cover shadow-sm ring-1 ring-black/10"
      style={{
        width: large ? "1.75rem" : "1.5rem",
        height: large ? "1.3125rem" : "1.125rem",
      }}
    />
  );
}

export function PassengerCountryDisplay({
  passengerType,
  countryCode,
}: {
  passengerType: string;
  countryCode?: string;
}) {
  const isLocal = passengerType.toLowerCase() === "local";
  const country = findCountry(isLocal ? "LK" : countryCode);
  const typeLabel = isLocal ? "Local" : "Foreign";

  return (
    <span className="inline-flex items-center gap-1.5">
      <CountryFlag countryCode={country?.code} />
      <span>{country ? `${typeLabel} \u00b7 ${country.name}` : typeLabel}</span>
    </span>
  );
}
