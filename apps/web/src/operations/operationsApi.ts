import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface BoatDocument { id:string; name:string; fileName:string; contentType:string; uploadedAtUtc:string }
export interface Boat { id:string; ownerId:string; ownerName:string; name:string; registrationNumber:string; registrationDate:string; hullNumber:string; lengthMeters:number; widthMeters:number; maximumSpeedKnots:number; maximumCapacity:number; lifeJacketCount:number; gpsDeviceId?:string; approval:string; wildlifeApproval:string; imageUrl?:string; documents:BoatDocument[] }
export interface CreateBoat { name:string; registrationNumber:string; registrationDate:string; hullNumber:string; lengthMeters:number; widthMeters:number; maximumCapacity:number; imageUrl?:string; maximumSpeedKnots:number; lifeJacketCount:number; gpsDeviceId?:string }
export interface TripCrew { crewUserId:string; name:string; email:string; position:string; nicNumber?:string; certified:boolean }
export interface TripPassenger { id:string; name:string; identificationNumber:string; phoneNumber:string; ageCategory:string; passengerType:string; gender:string; registeredAtUtc:string }
export interface Trip { id:string; boatId:string; vesselName:string; registrationNumber:string; ownerName:string; scheduledDepartureUtc:string; actualDepartureUtc?:string; actualArrivalUtc?:string; route:string; passengerCount:number; status:string; shoreApproval:string; shoreNotes?:string; updatedAtUtc:string; invitationCode?:string; crew:TripCrew[]; hasActiveSos:boolean }
export interface DirectoryOwner { id:string; displayName:string; email:string; phoneNumber?:string; nicNumber?:string; bio?:string }
export interface DirectoryCrew { id:string; displayName:string; email:string; phoneNumber?:string; position:string; boatId?:string; ownerId:string; nicNumber?:string; certified:boolean }
export interface OperationsDirectory { owners:DirectoryOwner[]; crew:DirectoryCrew[] }
export interface SosAlert { id:string; tripId:string; vesselName:string; registrationNumber:string; location:string; passengersOnboard:number; natureOfEmergency:string; raisedAtUtc:string }
export interface TransferBoat { id:string; name:string; registrationNumber:string; status:string; ownerId:string; ownerName:string }
export interface TransferTrip { id:string; boatName:string; registrationNumber:string; ownerName:string; scheduledDepartureUtc:string; passengerCount:number; maximumCapacity:number; crewCount:number; status:string }
export interface TransferPassenger { id:string; name:string; identificationNumber:string; phoneNumber:string }
export interface TransferCrew { id:string; name:string; email:string; position:string }
export interface TransferOptions { source:TransferTrip; passengers:TransferPassenger[]; crew:TransferCrew[] }
export interface TransferRequest { clientRequestId:string; sourceTripId:string; destinationTripId:string; passengerIds:string[]; crewUserIds:string[]; reason:string; explanation?:string }
export interface TransferResult { transferId:string; sourceTripId:string; destinationTripId:string; passengerCount:number; crewCount:number; transferredAtUtc:string }
export interface TransferHistoryItem { personId:string; personType:'Passenger'|'Crew'; personName:string }
export interface TransferHistory { id:string; sourceTripId:string; sourceBoat:string; sourceRegistrationNumber:string; sourceOwner:string; destinationTripId:string; destinationBoat:string; destinationRegistrationNumber:string; destinationOwner:string; initiatedBy:string; reason:string; explanation?:string; status:string; transferredAtUtc:string; items:TransferHistoryItem[] }
export interface OwnerCrew { assignmentId:string; crewUserId:string; name:string; email:string; phoneNumber?:string; position:string; certified:boolean }
export interface CreateTripResult { id:string; crewUserIds:string[]; crewAutoAssigned:boolean }
export interface CrewSuggestion { crewUserId:string; name:string; email:string; position:string }
export interface VesselMapRecord { id:string; name:string; registrationNumber:string; imageUrl?:string; certificationApproval:string; wildlifeApproval:string; shoreApproval:string; fullyApproved:boolean; latitude?:number; longitude?:number; coordinatesRecordedAtUtc?:string; departureUtc?:string; arrivalUtc?:string; lengthMeters:number; beamMeters:number; cruisingSpeedKnots?:number; maximumSpeedKnots:number; maximumCapacity:number; lifeJacketCount:number; passengerCount:number; childrenCount:number; specialNeedsCount:number; lifeSaverCount:number; diverCount:number; coxswainCount:number }

async function request<T>(path:string, token:string, init?:RequestInit):Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...init?.headers} });
  if (!response.ok) {
    const problem=await response.json().catch(()=>null) as {message?:string;detail?:string;title?:string;errors?:Record<string,string[]>}|null;
    const validation=problem?.errors ? Object.values(problem.errors).flat()[0] : undefined;
    throw new Error(response.status === 403 ? 'You are not permitted to perform this action.' : problem?.message ?? validation ?? problem?.detail ?? problem?.title ?? `Request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const operationsApi = {
  boats:(token:string)=>request<Boat[]>('/api/operations/boats',token),
  createBoat:(token:string,boat:CreateBoat)=>request<{id:string}>('/api/operations/boats',token,{method:'POST',body:JSON.stringify(boat)}),
  uploadBoatDocument:async(token:string,boatId:string,name:string,file:File)=>{
    const form=new FormData();form.append('name',name);form.append('file',file);
    const response=await fetch(`${API_BASE_URL}/api/operations/boats/${boatId}/documents`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
    if(!response.ok)throw new Error(`Certificate upload failed (${response.status}).`);
    return response.json() as Promise<BoatDocument>;
  },
  downloadBoatDocument:async(token:string,boatId:string,documentId:string)=>{
    const response=await fetch(`${API_BASE_URL}/api/operations/boats/${boatId}/documents/${documentId}`,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok)throw new Error('Unable to open certificate.');
    return URL.createObjectURL(await response.blob());
  },
  trips:(token:string)=>request<Trip[]>('/api/operations/trips',token),
  tripPassengers:(token:string,tripId:string)=>request<TripPassenger[]>(`/api/operations/trips/${tripId}/passengers?updated=${Date.now()}`,token,{cache:'no-store'}),
  createTrip:(token:string,boatId:string,scheduledDepartureUtc:string,crewUserIds:string[])=>request<CreateTripResult>('/api/operations/trips',token,{method:'POST',body:JSON.stringify({boatId,scheduledDepartureUtc,route:'To be confirmed',passengerCount:0,crewUserIds})}),
  directory:(token:string)=>request<OperationsDirectory>('/api/operations/directory',token),
  ownerCrew:(token:string)=>request<OwnerCrew[]>('/api/operations/owner/crew',token),
  searchOwnerCrew:(token:string,query:string)=>request<CrewSuggestion[]>(`/api/operations/owner/crew/search?query=${encodeURIComponent(query)}`,token),
  addOwnerCrew:(token:string,email:string)=>request<OwnerCrew>('/api/operations/owner/crew',token,{method:'POST',body:JSON.stringify({email})}),
  removeOwnerCrew:(token:string,assignmentId:string)=>request<void>(`/api/operations/owner/crew/${assignmentId}`,token,{method:'DELETE'}),
  vesselMap:(token:string)=>request<VesselMapRecord[]>('/api/operations/vessel-map',token),
  sosAlerts:(token:string)=>request<SosAlert[]>('/api/operations/sos',token),
  approve:(token:string,id:string,approval:'Approved'|'Rejected',notes?:string)=>request<void>(`/api/operations/trips/${id}/shore-approval`,token,{method:'PATCH',body:JSON.stringify({approval,notes})}),
  status:(token:string,id:string,status:string)=>request<void>(`/api/operations/trips/${id}/status`,token,{method:'PATCH',body:JSON.stringify({status})}),
  approveBoat:(token:string,id:string,approval:'Approved'|'Rejected',notes?:string)=>request<void>(`/api/operations/boats/${id}/approval`,token,{method:'PATCH',body:JSON.stringify({approval,notes})}),
  approveCrew:(token:string,id:string,approval:'Approved'|'Rejected',notes?:string)=>request<void>(`/api/operations/crew/${id}/approval`,token,{method:'PATCH',body:JSON.stringify({approval,notes})}),
  transferOptions:(token:string,sourceTripId:string)=>request<TransferOptions>(`/api/operations/transfers/source/${sourceTripId}`,token),
  searchTransferBoats:(token:string,sourceTripId:string,query:string)=>request<TransferBoat[]>(`/api/operations/transfers/destination-boats?sourceTripId=${encodeURIComponent(sourceTripId)}&query=${encodeURIComponent(query)}`,token),
  transferBoatTrips:(token:string,sourceTripId:string,boatId:string)=>request<TransferTrip[]>(`/api/operations/transfers/destination-boats/${encodeURIComponent(boatId)}/trips?sourceTripId=${encodeURIComponent(sourceTripId)}`,token),
  transferPeople:(token:string,details:TransferRequest)=>request<TransferResult>('/api/operations/transfers',token,{method:'POST',body:JSON.stringify(details)}),
  transferHistory:(token:string)=>request<TransferHistory[]>('/api/operations/transfers/history',token),
};
export function connectOperations(token:string,onChange:()=>void) {
  const connection = new HubConnectionBuilder().withUrl(`${API_BASE_URL}/hubs/operations`,{accessTokenFactory:()=>token}).withAutomaticReconnect().configureLogging(LogLevel.Warning).build();
  connection.on('operationsChanged',onChange); connection.start().catch(console.error);
  return ()=>{ void connection.stop(); };
}
export const formatTripDate=(value:string)=>new Intl.DateTimeFormat('en-LK',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
