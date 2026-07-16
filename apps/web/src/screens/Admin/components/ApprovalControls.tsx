import { useState } from "react";
import type { ApprovalStatus } from "../adminData";

export default function ApprovalControls({ initialStatus, initialReason, onChange }: { initialStatus: ApprovalStatus; initialReason?: string; onChange?: (status: ApprovalStatus, reason?: string) => void }) {
  const [status, setStatus] = useState(initialStatus);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState(initialReason ?? "");
  const update = (next: ApprovalStatus, declineReason?: string) => { setStatus(next); setDeclining(false); onChange?.(next, declineReason); };
  return <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Registration status</p><p className={`mt-2 text-sm font-semibold ${status === "Approved" ? "text-emerald-600" : status === "Declined" ? "text-red-600" : "text-amber-600"}`}>{status}</p></div>
    {status === "Pending" && <div className="flex gap-3"><button onClick={() => update("Approved")} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white">Approve</button><button onClick={() => setDeclining(true)} className="rounded-lg border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600">Decline</button></div>}</div>
    {status === "Declined" && reason && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"><span className="font-semibold">Reason:</span> {reason}</p>}
    {declining && <div className="mt-5 border-t border-slate-100 pt-5"><label className="text-sm font-semibold">Reason for declining <span className="text-red-500">*</span></label><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what must be corrected before resubmission" className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-indigo-500"/><div className="mt-3 flex justify-end gap-3"><button onClick={() => setDeclining(false)} className="px-4 py-2 text-sm text-slate-500">Cancel</button><button disabled={!reason.trim()} onClick={() => update("Declined", reason.trim())} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Confirm decline</button></div></div>}
  </section>;
}
