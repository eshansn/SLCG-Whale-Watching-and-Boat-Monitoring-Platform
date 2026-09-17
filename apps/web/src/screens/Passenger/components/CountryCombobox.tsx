import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { countries, filterCountries, findCountry } from "../../../data/countries";
import { CountryFlag } from "../../../components/CountryFlag";

interface CountryComboboxProps {
  value?: string;
  onChange: (countryCode: string) => void;
  tone?: "dark" | "light";
  id?: string;
}

export default function CountryCombobox({
  value = "",
  onChange,
  tone = "light",
  id,
}: CountryComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? `country-${generatedId}`;
  const listId = `${inputId}-listbox`;
  const selected = findCountry(value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized || selected && query === selected.name) return countries;
    return filterCountries(normalized);
  }, [query, selected]);

  const choose = (index: number): void => {
    const country = matches[index];
    if (!country) return;
    onChange(country.code);
    setQuery(country.name);
    setOpen(false);
  };

  const inputClasses = tone === "dark"
    ? "h-11 w-full rounded-lg border border-transparent bg-white pr-10 pl-10 font-poppins text-sm text-[#111] outline-none placeholder:text-[#777] focus:border-[#5cefdc] focus:shadow-[0_0_0_3px_rgba(92,239,220,.2)]"
    : "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-10 font-poppins text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-black focus:bg-white focus:ring-4 focus:ring-black/10";

  return (
    <div className="relative" ref={containerRef}>
      <label className={tone === "dark" ? "sr-only" : "mb-2 block font-poppins text-xs font-medium text-slate-700"} htmlFor={inputId}>
        Country
      </label>
      <div className="relative">
        {selected ? (
          <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2">
            <CountryFlag countryCode={selected.code} />
          </span>
        ) : (
          <Search className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={16} aria-hidden="true" />
        )}
        <input
          id={inputId}
          className={inputClasses}
          value={query}
          placeholder="Search country"
          autoComplete="country-name"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && matches[activeIndex] ? `${listId}-${matches[activeIndex].code}` : undefined}
          onFocus={(event) => {
            setOpen(true);
            setActiveIndex(Math.max(0, countries.findIndex((country) => country.code === value)));
            event.currentTarget.select();
          }}
          onBlur={(event) => {
            if (!containerRef.current?.contains(event.relatedTarget)) setOpen(false);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange("");
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && open) {
              event.preventDefault();
              choose(activeIndex);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400" size={17} aria-hidden="true" />
      </div>

      {open && (
        <ul
          id={listId}
          className="absolute z-[1100] mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-2xl"
          role="listbox"
          aria-label="Countries"
        >
          {matches.length ? matches.map((country, index) => (
            <li
              id={`${listId}-${country.code}`}
              key={country.code}
              className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 font-poppins text-sm text-slate-900 ${index === activeIndex ? "bg-slate-100" : "hover:bg-slate-50"}`}
              role="option"
              aria-selected={country.code === value}
              tabIndex={-1}
              onPointerDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <CountryFlag countryCode={country.code} large />
              <span className="min-w-0 flex-1 truncate">{country.name}</span>
              <span className="text-xs text-slate-400">{country.code}</span>
              {country.code === value && <Check size={15} aria-hidden="true" />}
            </li>
          )) : (
            <li className="px-3 py-4 text-center font-poppins text-sm text-slate-500">No matching country</li>
          )}
        </ul>
      )}
    </div>
  );
}
