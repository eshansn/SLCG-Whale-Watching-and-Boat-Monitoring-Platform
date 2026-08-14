import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { ApprovalStatus, BoatRecord, CrewRecord, OwnerRecord } from "./adminData";
import { useAuth } from "../../auth/useAuth";
import { connectOperations, operationsApi } from "../../operations/operationsApi";

interface RecordsState { boats: BoatRecord[]; crew: CrewRecord[]; owners: OwnerRecord[] }
interface RecordsContextValue extends RecordsState {
  updateBoat: (id: string, values: Partial<BoatRecord>) => Promise<void>;
  updateCrew: (id: string, values: Partial<CrewRecord>) => Promise<void>;
  updateOwner: (id: string, values: Partial<OwnerRecord>) => Promise<void>;
  setBoatApproval: (id: string, status: ApprovalStatus, reason?: string) => Promise<void>;
  setCrewApproval: (id: string, status: ApprovalStatus, reason?: string) => Promise<void>;
  deleteBoat: (id: string) => Promise<void>;
  deleteCrew: (id: string) => Promise<void>;
  deleteOwner: (id: string) => Promise<void>;
}

const initial: RecordsState = { boats: [], crew: [], owners: [] };
const Context = createContext<RecordsContextValue | null>(null);

export function AdminRecordsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [state, setState] = useState<RecordsState>(initial);

  useEffect(() => {
    if (!session || !session.roles.some((role) => role === "Admin" || role === "Wildlife")) return;
    let active = true;
    const load = () => void Promise.all([
      operationsApi.boats(session.accessToken),
      operationsApi.trips(session.accessToken),
      operationsApi.directory(session.accessToken),
      session.roles.includes("Admin") ? operationsApi.adminCrew(session.accessToken) : Promise.resolve(null),
    ]).then(([apiBoats, apiTrips, directory, adminCrew]) => {
      if (!active) return;
      const crewDirectory = adminCrew ?? directory.crew;
      const owners: OwnerRecord[] = directory.owners.map((owner) => ({ id: owner.id, apiId: owner.id, name: owner.displayName, nic: owner.nicNumber ?? "", email: owner.email, phone: owner.phoneNumber ?? "", address: owner.bio ?? "", boatIds: apiBoats.filter((boat) => boat.ownerId === owner.id).map((boat) => boat.id) }));
      const boats: BoatRecord[] = apiBoats.map((boat) => ({ id: boat.id, apiId: boat.id, imageUrl: boat.imageUrl, documents: boat.documents, name: boat.name, registrationNumber: boat.registrationNumber, registrationDate: boat.registrationDate, hullNumber: boat.hullNumber, length: `${boat.lengthMeters} m`, width: `${boat.widthMeters} m`, capacity: boat.maximumCapacity, ownerId: boat.ownerId, crewIds: crewDirectory.filter((member) => member.boatId === boat.id).map((member) => member.id), approval: boat.approval === "Rejected" ? "Declined" : boat.approval as ApprovalStatus, certifications: boat.documents.map((document) => document.name), tripIds: apiTrips.filter((trip) => trip.boatId === boat.id).map((trip) => trip.id) }));
      const crew: CrewRecord[] = crewDirectory.map((member) => ({ id: member.id, apiId: member.id, ownerId: member.ownerId, name: member.displayName, nic: member.nicNumber ?? "", email: member.email, phone: member.phoneNumber ?? "", address: "bio" in member ? member.bio ?? "" : "", role: member.position as CrewRecord["role"], boatId: member.boatId, approval: member.certified ? "Approved" : "Pending", certifications: member.certified ? ["Certified crew account"] : [], tripIds: apiTrips.filter((trip) => trip.crew.some((assignment) => assignment.crewUserId === member.id)).map((trip) => trip.id) }));
      setState({ owners, boats, crew });
    }).catch(() => undefined);
    load();
    const disconnect = connectOperations(session.accessToken, load);
    return () => { active = false; disconnect(); };
  }, [session]);

  const patch = <K extends keyof RecordsState>(key: K, id: string, values: Partial<RecordsState[K][number]>) =>
    setState((current) => ({ ...current, [key]: current[key].map((item) => item.id === id ? { ...item, ...values } : item) }));

  const value: RecordsContextValue = {
    ...state,
    updateBoat: async (id, values) => {
      const boat = state.boats.find((item) => item.id === id);
      const ownerId = values.ownerId ?? boat?.ownerId;
      const owner = state.owners.find((item) => item.id === ownerId);
      if (!boat?.apiId || !owner?.apiId || !session) throw new Error("The boat could not be updated.");
      const lengthMeters = parseMeasurement(values.length ?? boat.length);
      const widthMeters = parseMeasurement(values.width ?? boat.width);
      await operationsApi.updateAdminBoat(session.accessToken, boat.apiId, {
        ownerId: owner.apiId,
        name: String(values.name ?? boat.name),
        registrationNumber: String(values.registrationNumber ?? boat.registrationNumber),
        registrationDate: String(values.registrationDate ?? boat.registrationDate),
        hullNumber: String(values.hullNumber ?? boat.hullNumber),
        lengthMeters,
        widthMeters,
        maximumCapacity: Number(values.capacity ?? boat.capacity),
      });
      patch("boats", id, { ...values, ownerId, length: `${lengthMeters} m`, width: `${widthMeters} m` });
      setState((current) => ({
        ...current,
        owners: current.owners.map((record) => ({
          ...record,
          boatIds: record.id === ownerId
            ? [...new Set([...record.boatIds, id])]
            : record.boatIds.filter((boatId) => boatId !== id),
        })),
      }));
    },
    updateCrew: async (id, values) => {
      const member = state.crew.find((item) => item.id === id);
      const boatId = values.boatId;
      const boat = boatId === undefined ? undefined : state.boats.find((item) => item.id === boatId);
      if (!member?.apiId || !session || (boatId !== undefined && !boat?.apiId))
        throw new Error("The crew member could not be updated.");
      await operationsApi.updateAdminCrew(session.accessToken, member.apiId, {
        name: String(values.name ?? member.name),
        nic: String(values.nic ?? member.nic),
        email: String(values.email ?? member.email),
        phone: String(values.phone ?? member.phone),
        address: String(values.address ?? member.address),
        role: String(values.role ?? member.role),
        boatId: boat?.apiId,
      });
      patch("crew", id, { ...values, boatId, ownerId: boat?.ownerId ?? member.ownerId });
      setState((current) => ({
        ...current,
        boats: current.boats.map((record) => ({
          ...record,
          crewIds: record.id === boatId
            ? [...new Set([...record.crewIds, id])]
            : record.crewIds.filter((crewId) => crewId !== id),
        })),
      }));
    },
    updateOwner: async (id, values) => {
      const owner = state.owners.find((item) => item.id === id);
      if (!owner?.apiId || !session) throw new Error("The boat owner could not be updated.");
      await operationsApi.updateAdminOwner(session.accessToken, owner.apiId, {
        name: String(values.name ?? owner.name),
        nic: String(values.nic ?? owner.nic),
        email: String(values.email ?? owner.email),
        phone: String(values.phone ?? owner.phone),
        address: String(values.address ?? owner.address),
      });
      patch("owners", id, values);
    },
    setBoatApproval: async (id, approval, declineReason) => {
      const boat = state.boats.find((item) => item.id === id);
      if (!boat?.apiId || !session) throw new Error("The boat approval could not be updated.");
      await operationsApi.approveBoat(session.accessToken, boat.apiId, approval === "Approved" ? "Approved" : "Rejected", declineReason);
      patch("boats", id, { approval, declineReason: approval === "Declined" ? declineReason : undefined });
    },
    setCrewApproval: async (id, approval, declineReason) => {
      const member = state.crew.find((item) => item.id === id);
      if (!member?.apiId || !session) throw new Error("The crew approval could not be updated.");
      await operationsApi.approveCrew(session.accessToken, member.apiId, approval === "Approved" ? "Approved" : "Rejected", declineReason);
      patch("crew", id, { approval, declineReason: approval === "Declined" ? declineReason : undefined });
    },
    deleteBoat: async (id) => {
      const boat = state.boats.find((item) => item.id === id);
      if (!boat?.apiId || !session) throw new Error("The boat could not be deleted.");
      await operationsApi.deleteBoat(session.accessToken, boat.apiId);
      setState((current) => ({ ...current, boats: current.boats.filter((item) => item.id !== id), owners: current.owners.map((owner) => ({ ...owner, boatIds: owner.boatIds.filter((boatId) => boatId !== id) })), crew: current.crew.map((member) => member.boatId === id ? { ...member, boatId: undefined } : member) }));
    },
    deleteCrew: async (id) => {
      const member = state.crew.find((item) => item.id === id);
      if (!member?.apiId || !session) throw new Error("The crew member could not be deleted.");
      await operationsApi.deleteAdminCrew(session.accessToken, member.apiId);
      setState((current) => ({ ...current, crew: current.crew.filter((item) => item.id !== id), boats: current.boats.map((boat) => ({ ...boat, crewIds: boat.crewIds.filter((crewId) => crewId !== id) })) }));
    },
    deleteOwner: async (id) => {
      const owner = state.owners.find((item) => item.id === id);
      if (state.boats.some((boat) => boat.ownerId === id))
        throw new Error("This owner cannot be deleted while boats are registered under the account.");
      if (!owner?.apiId || !session) throw new Error("The boat owner could not be deleted.");
      await operationsApi.deleteAdminOwner(session.accessToken, owner.apiId);
      setState((current) => ({ ...current, owners: current.owners.filter((item) => item.id !== id) }));
    },
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function parseMeasurement(value: unknown): number {
  return Number.parseFloat(String(value).replace(",", "."));
}

export function useAdminRecords() {
  const value = useContext(Context);
  if (!value) throw new Error("Admin records provider is missing");
  return value;
}
