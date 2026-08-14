const ACTIVE_TRIP_INVITATION_KEY = 'wwms.passenger.tripInvitation';
const SESSION_TOKEN_KEY = 'wwms.passenger.sessionToken';
const LEGACY_PASSENGER_ID_KEY = 'wwms.passenger.id';
const LEGACY_PASSENGERS_KEY = 'whaleWatchingPassengers';
const LEGACY_ACTIVE_PARTY_KEY = 'whaleWatchingActivePassengerParty';

export function beginPassengerRegistration(): void {
  purgeLegacyPassengerData();
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

export function activatePassengerTrip(invitationCode: string): void {
  purgeLegacyPassengerData();
  const currentInvitation = sessionStorage.getItem(ACTIVE_TRIP_INVITATION_KEY);
  if (currentInvitation !== invitationCode) {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
  }
  sessionStorage.setItem(ACTIVE_TRIP_INVITATION_KEY, invitationCode);
}

export function getActivePassengerTripInvitation(): string {
  purgeLegacyPassengerData();
  return sessionStorage.getItem(ACTIVE_TRIP_INVITATION_KEY) ?? '';
}

export function storePassengerSession(invitationCode: string, sessionToken: string): void {
  purgeLegacyPassengerData();
  sessionStorage.setItem(ACTIVE_TRIP_INVITATION_KEY, invitationCode);
  sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
}

export function getPassengerSessionToken(): string {
  purgeLegacyPassengerData();
  return sessionStorage.getItem(SESSION_TOKEN_KEY) ?? '';
}

export function setActivePassengerTripInvitation(invitationCode: string): void {
  sessionStorage.setItem(ACTIVE_TRIP_INVITATION_KEY, invitationCode);
}

export function purgeLegacyPassengerData(): void {
  try {
    localStorage.removeItem(LEGACY_PASSENGERS_KEY);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
  try {
    sessionStorage.removeItem(LEGACY_ACTIVE_PARTY_KEY);
    sessionStorage.removeItem(LEGACY_PASSENGER_ID_KEY);
  } catch {
    // The server remains the source of truth when session storage is unavailable.
  }
}

purgeLegacyPassengerData();
