import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Info, Trash2, UserPlus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { connectOperations, operationsApi, type CrewSuggestion, type OwnerCrew } from "../../operations/operationsApi";
import { useAuth } from "../../auth/useAuth";

export default function BoatOwnerCrewPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const token = session?.accessToken;
  const [members, setMembers] = useState<OwnerCrew[]>([]);
  const [selected, setSelected] = useState<OwnerCrew>();
  const [email, setEmail] = useState("");
  const [suggestions, setSuggestions] = useState<CrewSuggestion[]>([]);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try { setMembers(await operationsApi.ownerCrew(token)); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to load crew."); }
  }, [token]);

  useEffect(() => { void load(); if(!token)return; return connectOperations(token,()=>void load()); }, [load,token]);
  useEffect(() => {
    if (!token || email.trim().length < 2) { setSuggestions([]); return; }
    const timer = window.setTimeout(() => operationsApi.searchOwnerCrew(token, email)
      .then(setSuggestions).catch(() => setSuggestions([])), 250);
    return () => window.clearTimeout(timer);
  }, [email, token]);

  const addMember = async (event: FormEvent) => {
    event.preventDefault(); if (!token || submitting) return;
    try {
      setSubmitting(true); setStatus("");
      await operationsApi.addOwnerCrew(token, email);
      setEmail(""); setSuggestions([]); await load(); setStatus("Certified crew member added successfully.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Unable to add crew member."); }
    finally { setSubmitting(false); }
  };

  const removeMember = async (member: OwnerCrew) => {
    if (!token || !window.confirm(`Remove ${member.name} from your crew?`)) return;
    try { await operationsApi.removeOwnerCrew(token, member.assignmentId); await load(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Unable to remove crew member."); }
  };

  return <main className="boat-owner-page min-h-dvh bg-white text-black">
    <div className="mx-auto w-full max-w-[900px] px-4 pb-12 pt-5 sm:px-8">
      <header className="relative flex min-h-12 items-center justify-center">
        <button type="button" aria-label="Go to dashboard" onClick={() => navigate('/owner')} className="absolute left-0 grid h-10 w-10 place-items-center rounded-full hover:bg-gray-100"><ArrowLeft /></button>
        <h1 className="text-xl font-semibold sm:text-2xl">My Crew</h1>
      </header>

      <section className="mt-7 overflow-hidden rounded-xl border border-slate-200" aria-label="Current crew members">
        <div className="grid grid-cols-[minmax(110px,1fr)_minmax(120px,2fr)_80px] gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <span>Name</span><span>Type</span><span className="text-center">Actions</span>
        </div>
        {members.length ? members.map((member) => <article key={member.assignmentId} className="grid min-h-16 grid-cols-[minmax(110px,1fr)_minmax(120px,2fr)_80px] items-center gap-2 border-t border-slate-100 px-4 text-sm">
          <div className="min-w-0"><p className="truncate font-medium">{member.name}</p><p className="truncate text-xs text-emerald-600">Certified</p></div>
          <p className="truncate">{member.position}</p>
          <div className="flex justify-center gap-1">
            <button type="button" onClick={() => setSelected(member)} aria-label={`View ${member.name} information`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100"><Info size={18}/></button>
            <button type="button" onClick={() => void removeMember(member)} aria-label={`Remove ${member.name}`} className="grid h-9 w-9 place-items-center rounded-full text-red-600 hover:bg-red-50"><Trash2 size={18}/></button>
          </div>
        </article>) : <p className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">No crew members have been added yet.</p>}
      </section>

      <form onSubmit={(event) => void addMember(event)} className="mt-6 rounded-2xl bg-[#162d54] p-6 text-white sm:p-8">
        <div className="mb-5 flex items-center gap-3"><UserPlus/><div><h2 className="text-xl font-semibold">Add certified crew member</h2><p className="text-xs text-white/70">The email must belong to a certified Boat Crew account.</p></div></div>
        <div className="relative">
          <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter certified crew member email" autoComplete="off" className="min-h-12 w-full rounded-lg bg-white px-4 text-sm text-slate-900 outline-none" />
          {suggestions.length > 0 && <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl">
            {suggestions.map((suggestion) => <button key={suggestion.crewUserId} type="button" onClick={() => { setEmail(suggestion.email); setSuggestions([]); }} className="flex w-full items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"><span><span className="block text-sm font-medium">{suggestion.name}</span><span className="block text-xs text-slate-500">{suggestion.email}</span></span><span className="text-xs text-slate-500">{suggestion.position}</span></button>)}
          </div>}
        </div>
        <button type="submit" disabled={submitting} className="mt-4 min-h-11 w-full rounded-lg bg-white px-5 text-sm font-semibold text-[#162d54] disabled:opacity-50">{submitting ? 'Adding...' : 'Add Member'}</button>
      </form>
      {status && <p role="status" className="mt-4 rounded-lg bg-slate-100 p-3 text-center text-sm text-[#162d54]">{status}</p>}
    </div>

    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label="Crew member information">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><h2 className="text-xl font-semibold">{selected.name}</h2><p className="text-sm text-emerald-600">Certified crew member</p></div><button type="button" onClick={() => setSelected(undefined)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100"><X size={20}/></button></div>
        <dl className="mt-5 space-y-3 text-sm">{[["Email",selected.email],["Phone",selected.phoneNumber || 'Not provided'],["Type",selected.position]].map(([label,value]) => <div key={label} className="flex justify-between gap-4 border-b border-slate-100 pb-2"><dt className="font-semibold">{label}</dt><dd className="text-right text-slate-600">{value}</dd></div>)}</dl>
      </section>
    </div>}
  </main>;
}
