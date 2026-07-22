const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface Complaint {
  id: string; passengerName: string; contact: string; boatId: string; boatName: string;
  registrationNumber: string; ownerName: string; type: string; message: string;
  createdAt: string; images: string[];
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const problem = await response.json().catch(() => null) as { message?: string; title?: string; errors?: Record<string, string[]> } | null;
  return problem?.message ?? (problem?.errors ? Object.values(problem.errors).flat()[0] : undefined) ?? problem?.title ?? fallback;
}

export async function submitComplaint(type: string, message: string, evidence: File | null): Promise<void> {
  const token = sessionStorage.getItem('wwms.passenger.sessionToken');
  if (!token) throw new Error('Your passenger session is missing. Please scan the trip QR code again.');
  const body = new FormData(); body.append('type', type); body.append('message', message);
  if (evidence) body.append('evidence', evidence);
  const response = await fetch(`${API_BASE_URL}/api/complaints`, { method: 'POST', headers: { 'X-Passenger-Session': token }, body });
  if (!response.ok) throw new Error(await errorMessage(response, 'Unable to submit your complaint.'));
}

export async function getComplaints(accessToken: string): Promise<Complaint[]> {
  const response = await fetch(`${API_BASE_URL}/api/complaints`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(await errorMessage(response, 'Unable to load complaints.'));
  return response.json() as Promise<Complaint[]>;
}
