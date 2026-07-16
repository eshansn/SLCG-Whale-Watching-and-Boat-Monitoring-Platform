export type ApprovalStatus = "Pending" | "Approved" | "Declined";

export interface TripRecord { id: number; date: string; route: string; passengers: number; status: "Completed" | "Scheduled"; }
export interface OwnerRecord { id: number; name: string; nic: string; email: string; phone: string; address: string; boatIds: number[]; }
export interface CrewRecord { id: number; name: string; nic: string; email: string; phone: string; address: string; role: "Captain" | "Life Saver" | "Deck Hand"; boatId?: number; approval: ApprovalStatus; declineReason?: string; certifications: string[]; tripIds: number[]; }
export interface BoatRecord { id: number; name: string; registrationNumber: string; registrationDate: string; hullNumber: string; length: string; width: string; capacity: number; ownerId: number; crewIds: number[]; approval: ApprovalStatus; declineReason?: string; certifications: string[]; tripIds: number[]; }

export const trips: TripRecord[] = [
  { id: 101, date: "2026-07-14", route: "Mirissa – Dondra Head", passengers: 28, status: "Completed" },
  { id: 102, date: "2026-07-12", route: "Mirissa – Weligama Bay", passengers: 22, status: "Completed" },
  { id: 103, date: "2026-07-18", route: "Mirissa – Dondra Head", passengers: 30, status: "Scheduled" },
  { id: 104, date: "2026-07-10", route: "Galle – Unawatuna", passengers: 18, status: "Completed" },
];

export const owners: OwnerRecord[] = [
  { id: 1, name: "Nimal Silva", nic: "901019029019", email: "nimal.silva@gmail.com", phone: "+94 77 123 4567", address: "42, Beach Road, Mirissa", boatIds: [1, 2] },
  { id: 2, name: "Kasun Perera", nic: "851220334V", email: "kasun.perera@gmail.com", phone: "+94 71 456 7890", address: "18, Harbour Road, Galle", boatIds: [3] },
];

export const crew: CrewRecord[] = [
  { id: 1, name: "Nimal Perera", nic: "95019029019", email: "nimal.p@gmail.com", phone: "+94 71 234 5678", address: "Matara", role: "Life Saver", boatId: 1, approval: "Approved", certifications: ["Certificate of Divers", "Life Saving Certificate"], tripIds: [101, 102] },
  { id: 2, name: "Amal Fernando", nic: "920440550V", email: "amal.f@gmail.com", phone: "+94 76 987 6543", address: "Weligama", role: "Captain", boatId: 1, approval: "Pending", certifications: ["Coxswain Certificate", "First Aid Certificate"], tripIds: [101] },
  { id: 3, name: "Dilan Kumara", nic: "981130440V", email: "dilan.k@gmail.com", phone: "+94 75 345 6789", address: "Galle", role: "Deck Hand", boatId: 3, approval: "Pending", certifications: ["Safety at Sea Certificate"], tripIds: [104] },
];

export const boats: BoatRecord[] = [
  { id: 1, name: "Mirissa King", registrationNumber: "SL-WB-0016", registrationDate: "2026-06-10", hullNumber: "156466", length: "25.7 m", width: "5.7 m", capacity: 150, ownerId: 1, crewIds: [1, 2], approval: "Approved", certifications: ["Sole Proprietorship Registration", "ME Certificate", "Certificate of Vessel", "Wildlife Certificate", "Coxswain Certificate", "Vessel Registration Certificate"], tripIds: [101, 102, 103] },
  { id: 2, name: "Ocean Pearl", registrationNumber: "SL-WB-0021", registrationDate: "2026-07-11", hullNumber: "156490", length: "18.2 m", width: "4.1 m", capacity: 80, ownerId: 1, crewIds: [], approval: "Pending", certifications: ["ME Certificate", "Certificate of Vessel"], tripIds: [] },
  { id: 3, name: "Blue Horizon", registrationNumber: "SL-WB-0019", registrationDate: "2026-05-22", hullNumber: "156472", length: "20.4 m", width: "4.8 m", capacity: 95, ownerId: 2, crewIds: [3], approval: "Pending", certifications: ["ME Certificate", "Wildlife Certificate", "Vessel Registration Certificate"], tripIds: [104] },
];

export const findOwner = (id: string | undefined) => owners.find((item) => item.id === Number(id));
export const findCrew = (id: string | undefined) => crew.find((item) => item.id === Number(id));
export const findBoat = (id: string | undefined) => boats.find((item) => item.id === Number(id));
