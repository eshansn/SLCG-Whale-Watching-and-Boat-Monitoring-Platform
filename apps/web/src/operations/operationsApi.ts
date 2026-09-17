import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { API_BASE_URL, apiFetch } from '../api/httpClient';

const INITIAL_CONNECTION_RETRY_DELAYS_MS = [1000, 5000, 10000, 30000] as const;

export type BoatDocumentStatus='PendingReview'|'Approved'|'Rejected'|'Expired'|'Superseded';
export type BoatDocumentRenewalState='Valid'|'ExpiringSoon'|'Expired'|'PendingReview'|'PendingVerification'|'Rejected'|'Superseded';
export interface BoatDocument { id:string; documentType:string; name:string; fileName:string; contentType:string; fileSize:number; uploadedAtUtc:string; expirationDate?:string; status:BoatDocumentStatus; version:number; isCurrent:boolean; replacesDocumentId?:string; rejectionReason?:string; verifiedAtUtc?:string; uploadedBy?:string; verifiedBy?:string; renewalState:BoatDocumentRenewalState }
export interface Boat { id:string; ownerId:string; ownerName:string; name:string; registrationNumber:string; registrationDate:string; hullNumber:string; lengthMeters:number; widthMeters:number; maximumSpeedKnots:number; maximumCapacity:number; lifeJacketCount:number; gpsDeviceId?:string; isPatrolBoat:boolean; approval:string; wildlifeApproval:string; imageUrl?:string; documentRequirementsVersion:number; registrationSubmittedAtUtc?:string; documents:BoatDocument[] }
export interface CreateBoat { name:string; registrationNumber:string; registrationDate:string; hullNumber:string; lengthMeters:number; widthMeters:number; maximumCapacity:number; imageUrl?:string; maximumSpeedKnots:number; lifeJacketCount:number; gpsDeviceId?:string }
export interface UpdateAdminBoat { ownerId:string; name:string; registrationNumber:string; registrationDate:string; hullNumber:string; lengthMeters:number; widthMeters:number; maximumCapacity:number }
export interface UpdateAdminOwner { name:string; nic:string; email:string; phone:string; address:string }
export interface UpdateAdminCrew extends UpdateAdminOwner { role:string; boatId?:string }
export interface TripCrew { crewUserId:string; name:string; email:string; position:string; nicNumber?:string; certified:boolean }
export interface TripPassenger { id:string; name:string; identificationNumber:string; phoneNumber:string; ageCategory:string; passengerType:string; countryCode?:string; gender:string; registeredAtUtc:string }
export interface Trip { id:string; boatId:string; vesselName:string; registrationNumber:string; ownerName:string; scheduledDepartureUtc:string; actualDepartureUtc?:string; actualArrivalUtc?:string; route:string; passengerCount:number; type:'WhaleWatching'|'Patrol'; status:string; shoreNotes?:string; updatedAtUtc:string; invitationCode?:string; crew:TripCrew[]; hasActiveSos:boolean; passengerVerificationFinalizedAtUtc?:string; startedByUserId?:string; startedByRole?:string; declineReason?:string; declinedByUserId?:string; declinedAtUtc?:string; rescheduleOverride:boolean; rescheduleOverrideByUserId?:string; rescheduleOverrideAtUtc?:string; rescheduleOverrideReason?:string }
export interface TripRoutePoint { latitude:number; longitude:number; recordedAtUtc:string; speedKnots?:number; headingDegrees?:number }
export interface TripStop { startedAtUtc:string; endedAtUtc?:string; durationSeconds:number; latitude:number; longitude:number; isOngoing:boolean; speedKnots?:number }
export interface TripTrackingSummary { tripId:string; boatId:string; status:'NotStarted'|'Active'|'Completed'; startedAtUtc?:string; endedAtUtc?:string; routeLength?:number; routeLengthUnit:string; moveDurationSeconds?:number; stopsDurationSeconds?:number; averageSpeed?:number; speedUnit:string; currentPosition?:TripRoutePoint; route:TripRoutePoint[]; stops:TripStop[] }
export interface BoatHistoricalTrip { tripId:string; routeName:string; status:string; startedAtUtc:string; endedAtUtc?:string; routeLength?:number; moveDurationSeconds?:number; stopsDurationSeconds?:number; averageSpeed?:number; route:TripRoutePoint[]; stops:TripStop[] }
export interface BoatHistoricalRoute { segmentNumber:number; startedAtUtc:string; endedAtUtc:string; routeLength?:number; moveDurationSeconds?:number; stopsDurationSeconds?:number; averageSpeed?:number; route:TripRoutePoint[]; stops:TripStop[] }
export interface BoatRouteHistory { boatId:string; fromUtc:string; toUtc:string; summary:{ totalDistance:number; distanceUnit:string; totalTrips:number; movingDurationSeconds:number; stopsDurationSeconds:number; averageSpeed?:number; speedUnit:string }; lastKnownPosition?:TripRoutePoint; trips:BoatHistoricalTrip[]; unassignedRoutes:BoatHistoricalRoute[] }
export interface DirectoryOwner { id:string; displayName:string; email:string; phoneNumber?:string; nicNumber?:string; bio?:string }
export interface DirectoryCrew { id:string; displayName:string; email:string; phoneNumber?:string; position:string; boatId?:string; ownerId:string; nicNumber?:string; certified:boolean }
export interface OperationsDirectory { owners:DirectoryOwner[]; crew:DirectoryCrew[] }
export interface AdminCrew { id:string; displayName:string; email:string; phoneNumber?:string; position:string; nicNumber?:string; bio?:string; certified:boolean; ownerId?:string; boatId?:string }
export interface SosAlert { id:string; tripId:string; vesselName:string; registrationNumber:string; location:string; passengersOnboard:number; natureOfEmergency:string; raisedAtUtc:string; hasActions:boolean }
export interface SosAction { id:string; sosEventId:string; takenByName:string; takenByIdNumber:string; details:string; takenAtUtc:string }
export interface CreateSosAction { responderName:string; responderIdNumber:string; details:string }
export interface TransferBoat { id:string; name:string; registrationNumber:string; status:string; ownerId:string; ownerName:string }
export interface TransferTrip { id:string; boatName:string; registrationNumber:string; ownerName:string; scheduledDepartureUtc:string; passengerCount:number; maximumCapacity:number; crewCount:number; status:string }
export interface TransferPassenger { id:string; name:string; identificationNumber:string; phoneNumber:string }
export interface TransferCrew { id:string; name:string; email:string; position:string }
export interface TransferOptions { source:TransferTrip; passengers:TransferPassenger[]; crew:TransferCrew[] }
export interface TransferRequest { clientRequestId:string; sourceTripId:string; destinationTripId:string; passengerIds:string[]; crewUserIds:string[]; reason:string; explanation?:string }
export interface TransferResult { transferId:string; sourceTripId:string; destinationTripId:string; passengerCount:number; crewCount:number; transferredAtUtc:string }
export interface TransferHistoryItem { personId:string; personType:'Passenger'|'Crew'; personName:string }
export interface TransferHistory { id:string; sourceTripId:string; sourceBoat:string; sourceRegistrationNumber:string; sourceOwner:string; destinationTripId:string; destinationBoat:string; destinationRegistrationNumber:string; destinationOwner:string; initiatedBy:string; reason:string; explanation?:string; status:string; transferredAtUtc:string; items:TransferHistoryItem[] }
export interface OwnerCrew { assignmentId:string; crewUserId:string; name:string; email:string; phoneNumber?:string; position:string; certified:boolean; assignedBoatId?:string; assignedBoatName?:string }
export interface CreateTripResult { id:string; crewUserIds:string[]; crewAutoAssigned:boolean }
export interface CrewSuggestion { crewUserId:string; name:string; email:string; position:string }
export interface GpsTelemetryUpdate { boatId:string; latitude:number; longitude:number; speedKnots?:number; headingDegrees?:number; altitudeMeters?:number; recordedAtUtc:string; receivedAtUtc:string; trackerStatus:'Online'|'Stale'|'Offline'; activeTripId?:string; activeTripStartedAtUtc?:string; activeTripStatus?:'Active'; stops?:TripStop[] }
export interface OperationsChange { entity?:string; id?:string; deleted?:boolean }
export interface VesselMapRecord { id:string; name:string; registrationNumber:string; imageUrl?:string; isPatrolBoat:boolean; activeTripId?:string; certificationApproval:string; wildlifeApproval:string; operationalStatus:string; latitude?:number; longitude?:number; coordinatesRecordedAtUtc?:string; coordinatesReceivedAtUtc?:string; trackerStatus:'Online'|'Stale'|'Offline'; headingDegrees?:number; altitudeMeters?:number; departureUtc?:string; arrivalUtc?:string; lengthMeters:number; beamMeters:number; cruisingSpeedKnots?:number; maximumSpeedKnots:number; maximumCapacity:number; lifeJacketCount:number; passengerCount:number; childrenCount:number; specialNeedsCount:number; lifeSaverCount:number; diverCount:number; coxswainCount:number }
export interface StartPatrolResult { id:string; boatId:string; startedAtUtc:string }

async function request<T>(path:string, token:string, init?:RequestInit):Promise<T> {
  const response = await apiFetch(path, { ...init, headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`, ...init?.headers} });
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
  cancelBoatRegistration:(token:string,id:string)=>request<void>(`/api/operations/boats/${id}/registration`,token,{method:'DELETE'}),
  uploadBoatDocument:async(token:string,boatId:string,documentType:string,file:File)=>{
    const form=new FormData();form.append('documentType',documentType);form.append('file',file);
    const response=await apiFetch(`/api/operations/boats/${boatId}/documents`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
    if(!response.ok){const problem=await response.json().catch(()=>null) as {message?:string;detail?:string;title?:string;errors?:Record<string,string[]>}|null;throw new Error(problem?.message??problem?.detail??(problem?.errors?Object.values(problem.errors).flat()[0]:undefined)??problem?.title??`Document upload failed (${response.status}).`);}
    return response.json() as Promise<BoatDocument>;
  },
  submitBoatRegistration:(token:string,boatId:string)=>request<void>(`/api/operations/boats/${boatId}/submit`,token,{method:'POST',body:'{}'}),
  boatDocuments:(token:string,boatId:string,documentType?:string)=>request<BoatDocument[]>(`/api/operations/boats/${boatId}/documents${documentType?`?documentType=${encodeURIComponent(documentType)}`:''}`,token),
  reviewBoatDocument:(token:string,boatId:string,documentId:string,status:'Approved'|'Rejected',expirationDate?:string,rejectionReason?:string)=>request<void>(`/api/operations/boats/${boatId}/documents/${documentId}/review`,token,{method:'PATCH',body:JSON.stringify({status,expirationDate:expirationDate||null,rejectionReason:rejectionReason||null})}),
  downloadBoatDocument:async(token:string,boatId:string,documentId:string)=>{
    const response=await apiFetch(`/api/operations/boats/${boatId}/documents/${documentId}`,{headers:{Authorization:`Bearer ${token}`}});
    if(!response.ok)throw new Error('Unable to open certificate.');
    return URL.createObjectURL(await response.blob());
  },
  trips:(token:string)=>request<Trip[]>('/api/operations/trips',token),
  tripTrackingSummary:(token:string,tripId:string)=>request<TripTrackingSummary>(`/api/operations/trips/${tripId}/tracking-summary?updated=${Date.now()}`,token,{cache:'no-store'}),
  boatRouteHistory:(token:string,boatId:string,from:string,to:string)=>request<BoatRouteHistory>(`/api/operations/boats/${boatId}/route-history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,token,{cache:'no-store'}),
  tripPassengers:(token:string,tripId:string)=>request<TripPassenger[]>(`/api/operations/trips/${tripId}/passengers?updated=${Date.now()}`,token,{cache:'no-store'}),
  createTrip:(token:string,boatId:string,scheduledDepartureUtc:string,crewUserIds:string[])=>request<CreateTripResult>('/api/operations/trips',token,{method:'POST',body:JSON.stringify({boatId,scheduledDepartureUtc,route:'To be confirmed',passengerCount:0,crewUserIds})}),
  rescheduleTrip:(token:string,id:string,scheduledDepartureUtc:string)=>request<void>(`/api/operations/trips/${id}/reschedule`,token,{method:'PATCH',body:JSON.stringify({scheduledDepartureUtc})}),
  startPatrol:(token:string,boatId:string,route:string)=>request<StartPatrolResult>('/api/operations/patrol-trips/start',token,{method:'POST',body:JSON.stringify({boatId,route})}),
  deleteTrip:(token:string,id:string)=>request<void>(`/api/operations/trips/${id}`,token,{method:'DELETE'}),
  directory:(token:string)=>request<OperationsDirectory>('/api/operations/directory',token),
  adminCrew:(token:string)=>request<AdminCrew[]>('/api/admin/crew',token),
  ownerCrew:(token:string)=>request<OwnerCrew[]>('/api/operations/owner/crew',token),
  searchOwnerCrew:(token:string,query:string)=>request<CrewSuggestion[]>(`/api/operations/owner/crew/search?query=${encodeURIComponent(query)}`,token),
  addOwnerCrew:(token:string,email:string)=>request<OwnerCrew>('/api/operations/owner/crew',token,{method:'POST',body:JSON.stringify({email})}),
  removeOwnerCrew:(token:string,assignmentId:string)=>request<void>(`/api/operations/owner/crew/${assignmentId}`,token,{method:'DELETE'}),
  boatCrew:(token:string,boatId:string)=>request<TripCrew[]>(`/api/operations/boats/${boatId}/crew`,token),
  assignCrewBoat:(token:string,crewUserId:string,boatId?:string)=>request<OwnerCrew>(`/api/operations/owner/crew/${crewUserId}/boat`,token,{method:'PUT',body:JSON.stringify({boatId:boatId||null})}),
  updateTripCrew:(token:string,tripId:string,crewUserIds:string[])=>request<TripCrew[]>(`/api/operations/trips/${tripId}/crew`,token,{method:'PUT',body:JSON.stringify({crewUserIds})}),
  vesselMap:(token:string)=>request<VesselMapRecord[]>('/api/operations/vessel-map',token),
  sosAlerts:(token:string)=>request<SosAlert[]>('/api/operations/sos',token),
  raiseCrewSos:(token:string,tripId:string)=>request<{id:string;raisedAtUtc:string}>(`/api/operations/trips/${tripId}/sos`,token,{method:'POST'}),
  sosActions:(token:string,tripId:string)=>request<SosAction[]>(`/api/operations/trips/${tripId}/sos-actions?updated=${Date.now()}`,token,{cache:'no-store'}),
  addSosAction:(token:string,tripId:string,action:CreateSosAction)=>request<SosAction>(`/api/operations/trips/${tripId}/sos-actions`,token,{method:'POST',body:JSON.stringify(action)}),
  startTrip:(token:string,id:string,confirmRescheduleOverride=false,overrideReason?:string)=>request<void>(`/api/operations/trips/${id}/start`,token,{method:'POST',body:JSON.stringify({confirmRescheduleOverride,overrideReason})}),
  declineTrip:(token:string,id:string,reason?:string)=>request<void>(`/api/operations/trips/${id}/decline`,token,{method:'POST',body:JSON.stringify({reason})}),
  endTrip:(token:string,id:string)=>request<void>(`/api/operations/trips/${id}/end`,token,{method:'POST',body:'{}'}),
  status:(token:string,id:string,status:string)=>request<void>(`/api/operations/trips/${id}/status`,token,{method:'PATCH',body:JSON.stringify({status})}),
  approveBoat:(token:string,id:string,approval:'Approved'|'Rejected',notes?:string)=>request<void>(`/api/operations/boats/${id}/approval`,token,{method:'PATCH',body:JSON.stringify({approval,notes})}),
  deleteBoat:(token:string,id:string)=>request<void>(`/api/operations/boats/${id}`,token,{method:'DELETE'}),
  approveCrew:(token:string,id:string,approval:'Approved'|'Rejected',notes?:string)=>request<void>(`/api/operations/crew/${id}/approval`,token,{method:'PATCH',body:JSON.stringify({approval,notes})}),
  updateAdminBoat:(token:string,id:string,details:UpdateAdminBoat)=>request<void>(`/api/admin/records/boats/${id}`,token,{method:'PATCH',body:JSON.stringify(details)}),
  updateAdminOwner:(token:string,id:string,details:UpdateAdminOwner)=>request<void>(`/api/admin/records/owners/${id}`,token,{method:'PATCH',body:JSON.stringify(details)}),
  updateAdminCrew:(token:string,id:string,details:UpdateAdminCrew)=>request<void>(`/api/admin/records/crew/${id}`,token,{method:'PATCH',body:JSON.stringify(details)}),
  deleteAdminOwner:(token:string,id:string)=>request<void>(`/api/admin/records/owners/${id}`,token,{method:'DELETE'}),
  deleteAdminCrew:(token:string,id:string)=>request<void>(`/api/admin/records/crew/${id}`,token,{method:'DELETE'}),
  transferOptions:(token:string,sourceTripId:string)=>request<TransferOptions>(`/api/operations/transfers/source/${sourceTripId}`,token),
  searchTransferBoats:(token:string,sourceTripId:string,query:string)=>request<TransferBoat[]>(`/api/operations/transfers/destination-boats?sourceTripId=${encodeURIComponent(sourceTripId)}&query=${encodeURIComponent(query)}`,token),
  transferBoatTrips:(token:string,sourceTripId:string,boatId:string)=>request<TransferTrip[]>(`/api/operations/transfers/destination-boats/${encodeURIComponent(boatId)}/trips?sourceTripId=${encodeURIComponent(sourceTripId)}`,token),
  transferPeople:(token:string,details:TransferRequest)=>request<TransferResult>('/api/operations/transfers',token,{method:'POST',body:JSON.stringify(details)}),
  transferHistory:(token:string)=>request<TransferHistory[]>('/api/operations/transfers/history',token),
};
export function connectOperations(token:string,onChange:(change?:OperationsChange)=>void,onGpsTelemetry?:(update:GpsTelemetryUpdate)=>void) {
  const connection = new HubConnectionBuilder().withUrl(`${API_BASE_URL}/hubs/operations`,{accessTokenFactory:()=>token}).withAutomaticReconnect().configureLogging(LogLevel.Warning).build();
  let disposed = false;
  let refreshAfterStart = false;
  let retryAttempt = 0;
  let retryTimer: number | undefined;

  const notifyChange = (change?:OperationsChange) => {
    if (disposed) return;
    try {
      onChange(change);
    } catch (error) {
      console.error('Unable to refresh operations after reconnecting.', error);
    }
  };
  const scheduleRetry = (error?: unknown) => {
    if (disposed || retryTimer !== undefined) return;
    refreshAfterStart = true;
    const delay = INITIAL_CONNECTION_RETRY_DELAYS_MS[Math.min(retryAttempt, INITIAL_CONNECTION_RETRY_DELAYS_MS.length - 1)];
    retryAttempt += 1;
    console.error(`Unable to connect to live operations. Retrying in ${delay / 1000} seconds.`, error);
    retryTimer = window.setTimeout(() => {
      retryTimer = undefined;
      void start();
    }, delay);
  };
  const start = async () => {
    try {
      await connection.start();
    } catch (error) {
      scheduleRetry(error);
      return;
    }

    if (disposed) {
      void connection.stop();
      return;
    }
    retryAttempt = 0;
    if (refreshAfterStart) notifyChange();
    refreshAfterStart = false;
  };

  connection.on('operationsChanged', (change:OperationsChange) => notifyChange(change));
  connection.on('gpsTelemetryUpdated', (update:GpsTelemetryUpdate) => {
    if (!disposed) onGpsTelemetry?.(update);
  });
  connection.onreconnected(() => notifyChange());
  connection.onclose(scheduleRetry);
  void start();

  return () => {
    disposed = true;
    if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    void connection.stop();
  };
}
export const formatTripDate=(value:string)=>new Intl.DateTimeFormat('en-LK',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export type TripDisplayState='Scheduled'|'Late'|'NeedsReschedule'|'Ongoing'|'Declined'|'Completed'|'Cancelled';
const SRI_LANKA_UTC_OFFSET_MS=330*60*1000;
const DAY_MS=24*60*60*1000;
const LATE_AFTER_MS=30*60*1000;
const isAwaitingDeparture=(status:string)=>status==='Scheduled'||status==='Boarding';
const sriLankaDay=(timestamp:number)=>Math.floor((timestamp+SRI_LANKA_UTC_OFFSET_MS)/DAY_MS);
export const isExpiredScheduledTrip=(trip:Pick<Trip,'status'|'scheduledDepartureUtc'>,now=Date.now())=>{
  const scheduled=new Date(trip.scheduledDepartureUtc).getTime();
  return isAwaitingDeparture(trip.status)&&Number.isFinite(scheduled)&&sriLankaDay(now)>sriLankaDay(scheduled);
};
export const isLateScheduledTrip=(trip:Pick<Trip,'status'|'scheduledDepartureUtc'>,now=Date.now())=>{
  const scheduled=new Date(trip.scheduledDepartureUtc).getTime();
  return isAwaitingDeparture(trip.status)&&Number.isFinite(scheduled)&&!isExpiredScheduledTrip(trip,now)&&now>=scheduled+LATE_AFTER_MS;
};
export const getTripDisplayState=(trip:Pick<Trip,'status'|'scheduledDepartureUtc'>,now=Date.now()):TripDisplayState=>{
  if(trip.status==='NeedsReschedule'||isExpiredScheduledTrip(trip,now))return'NeedsReschedule';
  if(isLateScheduledTrip(trip,now))return'Late';
  if(isAwaitingDeparture(trip.status))return'Scheduled';
  return trip.status==='Ongoing'||trip.status==='Declined'||trip.status==='Completed'||trip.status==='Cancelled'?trip.status:'Scheduled';
};
export const isOperationalTripVisible=(trip:Pick<Trip,'status'|'scheduledDepartureUtc'>,now=Date.now())=>
  trip.status!=='Completed'&&trip.status!=='Cancelled'&&trip.status!=='Declined'&&(!isExpiredScheduledTrip(trip,now)||trip.status==='NeedsReschedule');
