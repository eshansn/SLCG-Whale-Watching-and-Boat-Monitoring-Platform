export type PortalName = "boat-owner" | "crew" | "shore";
export type PortalPreference = "notifications" | "autoUpdates";

const preferenceKey = (
  userId: string,
  portal: PortalName,
  preference: PortalPreference,
) => `wwms.settings.${userId}.${portal}.${preference}`;

export function readPortalPreference(
  userId: string | undefined,
  portal: PortalName,
  preference: PortalPreference,
  defaultValue = true,
): boolean {
  if (!userId) return defaultValue;

  try {
    const storedValue = localStorage.getItem(
      preferenceKey(userId, portal, preference),
    );
    return storedValue === null ? defaultValue : storedValue === "true";
  } catch {
    return defaultValue;
  }
}

export function writePortalPreference(
  userId: string | undefined,
  portal: PortalName,
  preference: PortalPreference,
  value: boolean,
): void {
  if (!userId) return;

  try {
    localStorage.setItem(
      preferenceKey(userId, portal, preference),
      String(value),
    );
  } catch {
    // The setting still applies for this session when browser storage is unavailable.
  }
}
