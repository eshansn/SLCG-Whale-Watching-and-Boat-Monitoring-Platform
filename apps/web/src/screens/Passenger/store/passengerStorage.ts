import type { PassengerData } from "./passenger";

const STORAGE_KEY = "whaleWatchingPassengers";
const ACTIVE_PARTY_KEY = "whaleWatchingActivePassengerParty";

interface StoredPassenger extends PassengerData {
  partyId: string;
}

function readStoredPassengers(): StoredPassenger[] {
  const value = localStorage.getItem(STORAGE_KEY);
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((passenger): passenger is PassengerData => Boolean(
        passenger && typeof passenger === "object" &&
        "id" in passenger && "name" in passenger &&
        "identificationNumber" in passenger && "phoneNumber" in passenger,
      ))
      .map((passenger) => ({
        ...passenger,
        partyId: "partyId" in passenger && typeof passenger.partyId === "string"
          ? passenger.partyId
          : passenger.id,
      }));
  } catch {
    return [];
  }
}

function normalizeLookup(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

export function getPassengers(): PassengerData[] {
  const passengers = readStoredPassengers();
  const activeParty = sessionStorage.getItem(ACTIVE_PARTY_KEY);
  return (activeParty
    ? passengers.filter((passenger) => passenger.partyId === activeParty)
    : passengers
  ).map(({ partyId, ...passenger }) => {
    void partyId;
    return passenger;
  });
}

export function addPassenger(
  passenger: Omit<PassengerData, "id">,
): PassengerData[] {
  const passengers = readStoredPassengers();
  const partyId = sessionStorage.getItem(ACTIVE_PARTY_KEY) ?? crypto.randomUUID();
  sessionStorage.setItem(ACTIVE_PARTY_KEY, partyId);

  const newPassenger: StoredPassenger = {
    ...passenger,
    id: crypto.randomUUID(),
    partyId,
  };

  const updatedPassengers = [...passengers, newPassenger];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPassengers));

  return getPassengers();
}

export function clearPassengers(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(ACTIVE_PARTY_KEY);
}

export function beginPassengerRegistration(): void {
  sessionStorage.setItem(ACTIVE_PARTY_KEY, crypto.randomUUID());
}

export function findPassengerAndActivate(identifier: string): boolean {
  const lookup = normalizeLookup(identifier);
  const passenger = readStoredPassengers().find((candidate) =>
    normalizeLookup(candidate.identificationNumber) === lookup ||
    normalizeLookup(candidate.phoneNumber) === lookup,
  );

  if (!passenger) return false;
  sessionStorage.setItem(ACTIVE_PARTY_KEY, passenger.partyId);
  return true;
}
