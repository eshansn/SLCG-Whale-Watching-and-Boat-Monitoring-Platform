import type { BoatDocument, CrewCertificateStatus } from '../../operations/operationsApi';

export type ApprovalStatus="Pending"|"Approved"|"Declined";
export interface OwnerRecord{[key:string]:unknown;id:string;apiId?:string;name:string;nic:string;email:string;phone:string;address:string;boatIds:string[]}
export interface CrewRecord{[key:string]:unknown;id:string;apiId?:string;ownerId?:string;name:string;nic:string;email:string;phone:string;address:string;role:"Captain"|"Coxswain"|"Life Saver"|"Deck Hand"|"Diver"|"First Aid Officer";boatId?:string;approval:ApprovalStatus;declineReason?:string;certificate?:CrewCertificateStatus;certifications:string[];tripIds:string[]}
export type BoatDocumentRecord=BoatDocument;
export interface BoatRecord{[key:string]:unknown;id:string;apiId?:string;imageUrl?:string;documents?:BoatDocumentRecord[];documentRequirementsVersion:number;registrationSubmittedAtUtc?:string;name:string;registrationNumber:string;registrationDate:string;hullNumber:string;length:string;width:string;capacity:number;ownerId:string;crewIds:string[];approval:ApprovalStatus;declineReason?:string;certifications:string[];tripIds:string[]}
