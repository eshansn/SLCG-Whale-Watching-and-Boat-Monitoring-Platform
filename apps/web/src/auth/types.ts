export const PORTAL_ROLES = [
  'Admin',
  'SLTDA',
  'OPS',
  'ShoreCrew',
  'Wildlife',
  'ShoreWildlife',
  'Supervisor',
  'HarbourOfficer',
  'Passenger',
  'BoatOwner',
  'BoatCrew',
] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

export interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAtUtc: string;
  refreshToken: string;
  refreshTokenExpiresAtUtc: string;
  roles: PortalRole[];
}

export interface AuthSession extends AuthResponse {
  userId: string;
  email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
