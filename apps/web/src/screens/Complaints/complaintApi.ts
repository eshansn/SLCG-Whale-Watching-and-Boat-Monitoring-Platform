import { apiFetch } from '../../api/httpClient';

export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }
export interface ComplaintSummary {
  id: string; reference: string; kind: string; passengerId: string; passengerName: string; tripId: string;
  boatName: string; type: string; status: string; createdAtUtc: string; updatedAtUtc: string; pendingAuthorities: number;
}
export interface ComplaintDetail {
  complaint: ComplaintSummary & { message: string; version: string; contact: string | null; boatId: string;
    registrationNumber: string; ownerName: string; tripDate: string; tripStatus: string; evidence: { id: string; fileName: string }[] };
  assignments: Assignment[]; timeline: TimelineEvent[]; canMonitor: boolean; allowedStatuses: string[];
}
export interface Assignment { id: string; authorityRoleId: string; authority: string; note: string | null; status: string;
  forwardedAtUtc: string; forwardedBy: string; acknowledgedAtUtc: string | null; respondedAtUtc: string | null; updatedAtUtc: string; canRespond: boolean }
export interface TimelineEvent { id: string; assignmentId: string | null; authority: string | null; actor: string;
  action: string; text: string | null; previousStatus: string; status: string; assignmentStatus: string | null; createdAtUtc: string }
// Older API deployments return individual authorities without grouped role IDs.
export interface Authority { id: string; name: string; activeUsers: number; roleIds?: string[] }
export interface Notification { id: string; complaintId: string; assignmentId: string | null; reference: string; action: string;
  sender: string; category: string; kind: string; createdAtUtc: string; readAtUtc: string | null }
export interface Passenger { id: string; name: string; identificationNumber: string; phoneNumber: string; passengerType: string;
  countryCode: string | null; createdAtUtc: string; tripCount: number; complaintCount: number; inquiryCount: number; gender?: string; ageCategory?: string }
export interface PassengerTrip { tripId: string; registeredAtUtc: string; scheduledDepartureUtc: string; actualDepartureUtc: string | null;
  actualArrivalUtc: string | null; boatId: string; boatName: string; registrationNumber: string; route: string; status: string; attendance: string }
export interface MonitoringTrip { id: string; boatId: string; boatName: string; registrationNumber: string; ownerName: string;
  scheduledDepartureUtc: string; actualDepartureUtc: string | null; actualArrivalUtc: string | null; route: string; status: string; registeredPassengers: number }
export interface Dashboard { passengers: number; trips: number; completedTrips: number; registrations: number; complaints: number; inquiries: number;
  awaitingReview: number; awaitingAcknowledgment: number; awaitingResponses: number; resolved: number; closed: number;
  recentActivity: { id: string; complaintId: string; action: string; actor: string; createdAtUtc: string }[] }

export async function complaintRequest<T>(token: string, path: string, body?: unknown, method = 'POST'): Promise<T> {
  const response = await apiFetch(path, { method: body === undefined ? 'GET' : method,
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string; title?: string; errors?: Record<string, string[]> } | null;
    throw Object.assign(new Error(error?.message ?? (error?.errors ? Object.values(error.errors).flat().join(' ') : error?.title) ?? 'Unable to load this record.'), { status: response.status });
  }
  return response.json() as Promise<T>;
}

export const complaintStatuses = ['Submitted', 'UnderReview', 'Forwarded', 'Acknowledged', 'InProgress', 'Responded', 'Resolved', 'Closed', 'Reopened'];
export const label = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2');
export const date = (value?: string | null) => value ? new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo' }).format(new Date(value)) : '—';
export const reference = (id: string) => `WWMS-${id}`;
export function caseFilterDay(value: string | null, endExclusive = false) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? value : '';
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp + 330 * 60000 - (endExclusive ? 1 : 0)).toISOString().slice(0, 10) : '';
}
export const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
export const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#14223d] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#22375f] disabled:opacity-50';
