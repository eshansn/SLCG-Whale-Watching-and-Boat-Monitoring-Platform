const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface PassengerTripPreview {
  tripId: string;
  boatName: string;
  registrationNumber: string;
  scheduledDepartureUtc: string;
  status: string;
  shoreApproval: string;
  maximumCapacity: number;
  acceptingPassengers: boolean;
  invitationCode: string;
}

export async function getPassengerTrip(invitationCode: string): Promise<PassengerTripPreview> {
  const response = await fetch(`${API_BASE_URL}/api/passenger/trips/${encodeURIComponent(invitationCode)}`);
  if (response.status === 404) throw new Error('This trip invitation is invalid or no longer available.');
  if (!response.ok) throw new Error('Unable to load this trip invitation.');
  return response.json() as Promise<PassengerTripPreview>;
}

export async function getActivePassengerTrip():Promise<PassengerTripPreview>{
  const token=sessionStorage.getItem('wwms.passenger.sessionToken');
  if(!token)throw new Error('Your passenger session is missing.');
  const response=await fetch(`${API_BASE_URL}/api/passenger/session/trip`,{headers:{'X-Passenger-Session':token}});
  if(!response.ok)throw new Error('Unable to load your active trip.');
  return response.json() as Promise<PassengerTripPreview>;
}

export interface RegisterPassengerDetails { name:string; identificationNumber:string; phoneNumber:string; passengerType:'local'|'foreign'; gender:'male'|'female'|'other'; ageCategory:'adult'|'child' }
export interface RegisteredPassenger extends RegisterPassengerDetails { id:string; tripId:string; sessionToken:string; sessionExpiresAtUtc:string }
export interface RegisteredCompanion extends RegisterPassengerDetails { id:string; tripId:string; primaryPassengerId:string }
export interface PassengerPersonalQr { passengerId:string; passengerName:string; qrToken:string; qrValue:string }

export async function registerTripPassenger(invitationCode:string, details:RegisterPassengerDetails):Promise<RegisteredPassenger> {
  const response=await fetch(`${API_BASE_URL}/api/passenger/trips/${encodeURIComponent(invitationCode)}/passengers`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(details),
  });
  if(!response.ok){const problem=await response.json().catch(()=>null) as {message?:string;detail?:string;title?:string;errors?:Record<string,string[]>}|null;const validation=problem?.errors?Object.values(problem.errors).flat()[0]:undefined;throw new Error(problem?.message??validation??problem?.detail??problem?.title??'Passenger registration failed.');}
  return response.json() as Promise<RegisteredPassenger>;
}

export async function registerTravelCompanion(details:RegisterPassengerDetails):Promise<RegisteredCompanion>{
  const token=sessionStorage.getItem('wwms.passenger.sessionToken');
  if(!token)throw new Error('Your passenger session is missing. Please scan the trip QR code again.');
  const response=await fetch(`${API_BASE_URL}/api/passenger/session/companions`,{method:'POST',headers:{'Content-Type':'application/json','X-Passenger-Session':token},body:JSON.stringify(details)});
  if(!response.ok){const problem=await response.json().catch(()=>null) as {message?:string;detail?:string;title?:string;errors?:Record<string,string[]>}|null;const validation=problem?.errors?Object.values(problem.errors).flat()[0]:undefined;throw new Error(problem?.message??validation??problem?.detail??problem?.title??'Unable to add this travel companion.');}
  return response.json() as Promise<RegisteredCompanion>;
}

export async function getPassengerPersonalQr():Promise<PassengerPersonalQr>{
  const token=sessionStorage.getItem('wwms.passenger.sessionToken');
  if(!token)throw new Error('Your passenger session is missing.');
  const response=await fetch(`${API_BASE_URL}/api/passenger/session/qr`,{headers:{'X-Passenger-Session':token}});
  if(!response.ok)throw new Error('Unable to load your personal boarding QR code.');
  return response.json() as Promise<PassengerPersonalQr>;
}

export async function verifyReturningPassenger(invitationCode:string,identifier:string):Promise<RegisteredPassenger>{
  const response=await fetch(`${API_BASE_URL}/api/passenger/trips/${encodeURIComponent(invitationCode)}/returning-passenger`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier})});
  if(!response.ok){const problem=await response.json().catch(()=>null) as {message?:string;detail?:string;title?:string}|null;throw new Error(problem?.message??problem?.detail??problem?.title??'Passenger verification failed.');}
  return response.json() as Promise<RegisteredPassenger>;
}

export async function raisePassengerSos():Promise<void>{
  const token=sessionStorage.getItem('wwms.passenger.sessionToken');
  if(!token)throw new Error('Your passenger session is missing. Please scan the trip QR code again.');
  const response=await fetch(`${API_BASE_URL}/api/passenger/sos`,{method:'POST',headers:{'X-Passenger-Session':token}});
  if(!response.ok){const problem=await response.json().catch(()=>null) as {message?:string;detail?:string;title?:string}|null;throw new Error(problem?.message??problem?.detail??problem?.title??'Unable to send the SOS alert.');}
}
