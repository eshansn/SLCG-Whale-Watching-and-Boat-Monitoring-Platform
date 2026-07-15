import type { PassengerData } from "./passenger";

const STORAGE_KEY = "whaleWatchingPassengers";

export function getPassengers(): PassengerData[] {
  const storedPassengers = localStorage.getItem(STORAGE_KEY);

  if (!storedPassengers) {
    return [];
  }

  try {
    return JSON.parse(storedPassengers) as PassengerData[];
  } catch {
    return [];
  }
}

export function addPassenger(
  passenger: Omit<PassengerData, "id">,
): PassengerData[] {
  const passengers = getPassengers();

  const newPassenger: PassengerData = {
    ...passenger,
    id: crypto.randomUUID(),
  };

  const updatedPassengers = [...passengers, newPassenger];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPassengers));

  return updatedPassengers;
}

export function clearPassengers(): void {
  localStorage.removeItem(STORAGE_KEY);
}