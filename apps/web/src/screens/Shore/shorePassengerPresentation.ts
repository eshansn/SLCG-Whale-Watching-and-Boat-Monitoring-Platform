import { findCountry } from '../../data/countries';
import type { AttendancePassenger } from './shoreAttendanceApi';

export type ShorePassengerCategory = 'Local' | 'Foreign' | 'Not recorded';
export type ShoreAgeCategory = 'adult' | 'child' | 'small' | 'unknown';
export interface ShorePassengerCounts { adult: number; child: number; small: number; unknown: number; total: number }

// Registration normalizes Local to LK. Preserve a recorded country and never invent
// a foreign nationality when legacy records have no valid ISO country code.
export function presentShorePassenger(person: Pick<AttendancePassenger, 'passengerType' | 'countryCode' | 'ageCategory'>) {
  const type = person.passengerType?.trim().toLowerCase();
  const recordedCountry = findCountry(person.countryCode?.trim());
  const category: ShorePassengerCategory = type === 'local' ? 'Local' : type === 'foreign' ? 'Foreign'
    : recordedCountry ? recordedCountry.code === 'LK' ? 'Local' : 'Foreign' : 'Not recorded';
  const country = recordedCountry ?? (category === 'Local' ? findCountry('LK') : undefined);
  const storedAge = person.ageCategory?.trim().toLowerCase();
  // Matches WildlifeMonitoringController's existing adult/specialneeds counting rule.
  const age: ShoreAgeCategory = storedAge === 'adult' || storedAge === 'specialneeds' ? 'adult'
    : storedAge === 'child' ? 'child' : storedAge === 'small' ? 'small' : 'unknown';
  return { category, country, nationality: country?.name ?? 'Not recorded', age,
    ageLabel: age === 'adult' ? 'Adult' : age === 'child' ? 'Child' : age === 'small' ? 'Under 6' : 'Not recorded',
    specialNeeds: storedAge === 'specialneeds' };
}

const emptyCounts = (): ShorePassengerCounts => ({ adult: 0, child: 0, small: 0, unknown: 0, total: 0 });
export function summarizeShorePassengers(passengers: AttendancePassenger[]) {
  const local = emptyCounts(), foreign = emptyCounts(), unrecorded = emptyCounts(), total = emptyCounts();
  let specialNeeds = 0;
  for (const person of passengers) {
    // Use persisted attendance only; edited-but-unsaved check-in controls do not count.
    // The source list contains current trip assignments, so removed/transferred
    // passengers cannot be included by an old attendance record.
    if (person.status !== 'Present') continue;
    const display = presentShorePassenger(person);
    const row = display.category === 'Local' ? local : display.category === 'Foreign' ? foreign : unrecorded;
    row[display.age]++; row.total++;
    total[display.age]++; total.total++;
    if (display.specialNeeds) specialNeeds++;
  }
  return { local, foreign, unrecorded, total, specialNeeds };
}
