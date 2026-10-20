import type { ComplaintSummary } from '../Complaints/complaintApi';

export type AnalyticsInterval = 'daily' | 'weekly' | 'monthly';
export interface AnalyticsTrend { start: string; end: string; passengers: number; registrations: number; complaints: number; inquiries: number; unclassified: number }
export interface MonitoringAnalytics {
  from: string; to: string; interval: AnalyticsInterval; asOfUtc: string;
  totals: { totalPassengers: number; newPassengers: number; registrations: number; trips: number; completedTrips: number;
    complaints: number; inquiries: number; unclassified: number; cases: number; openCases: number; resolved: number; closed: number;
    awaitingReview: number; awaitingAcknowledgment: number; awaitingResponses: number };
  trends: AnalyticsTrend[]; statusDistribution: { status: string; count: number }[]; recentCases: ComplaintSummary[];
}
export interface TripHistoryRow { id: string; boatName: string; registrationNumber: string; ownerName: string; route: string;
  scheduledDepartureUtc: string; actualDepartureUtc: string | null; actualArrivalUtc: string | null; status: string; type: string; registeredPassengers: number }

export const localToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export const moveDay = (day: string, days: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
export const shortDay = (day: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Colombo' }).format(new Date(`${day}T00:00:00+05:30`));
export const fullDay = (day: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Colombo' }).format(new Date(`${day}T00:00:00+05:30`));
export const caseDateParams = (from: string, to: string) => ({ from: new Date(`${from}T00:00:00+05:30`).toISOString(), to: new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86400000).toISOString() });

export function exportAnalytics(data: MonitoringAnalytics) {
  const rows: (string | number)[][] = [
    ['SLTDA passenger activity summary'], ['Period start', data.from], ['Period end (inclusive)', data.to], ['Time zone', 'Asia/Colombo'], ['Generated at UTC', data.asOfUtc], [],
    ['Metric', 'Count'], ['Total passengers (all time)', data.totals.totalPassengers], ['New passenger profiles in period', data.totals.newPassengers], ['Trip participations registered in period', data.totals.registrations],
    ['Trips scheduled in period', data.totals.trips], ['Cases submitted in period', data.totals.cases], ['Complaint submissions', data.totals.complaints], ['Inquiry submissions', data.totals.inquiries], ['Unclassified submissions', data.totals.unclassified], ['Currently open cases submitted in period', data.totals.openCases], [],
    ['Bucket start', 'Bucket end', 'New passengers', 'Trip registrations', 'Complaints', 'Inquiries', 'Unclassified'], ...data.trends.map(p => [p.start, p.end, p.passengers, p.registrations, p.complaints, p.inquiries, p.unclassified]), [],
    ['Current status of cases submitted in period', 'Count'], ...data.statusDistribution.map(s => [s.status, s.count]),
  ];
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `SLTDA-activity-${data.from}-${data.to}.csv`; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
