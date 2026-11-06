import { createContext, useContext } from "react";
import type { ApprovalStatus, BoatRecord, CrewRecord, OwnerRecord } from "./adminData";

export interface RecordsState { boats: BoatRecord[]; crew: CrewRecord[]; owners: OwnerRecord[] }
export interface RecordsContextValue extends RecordsState {
  loading: boolean;
  error?: string;
  reload: () => void;
  updateBoat: (id: string, values: Partial<BoatRecord>) => Promise<void>;
  updateCrew: (id: string, values: Partial<CrewRecord>) => Promise<void>;
  updateOwner: (id: string, values: Partial<OwnerRecord>) => Promise<void>;
  setBoatApproval: (id: string, status: ApprovalStatus, reason?: string) => Promise<void>;
  setCrewApproval: (id: string, status: ApprovalStatus, reason?: string) => Promise<void>;
  deleteBoat: (id: string) => Promise<void>;
  deleteCrew: (id: string) => Promise<void>;
  deleteOwner: (id: string) => Promise<void>;
}

const Context = createContext<RecordsContextValue | null>(null);
export { Context as AdminRecordsContext };

export function useAdminRecords() {
  const value = useContext(Context);
  if (!value) throw new Error("Admin records provider is missing");
  return value;
}
