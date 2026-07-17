import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/ui/icon";
import { formatTripDate, type Trip } from "../../operations/operationsApi";
import { useOperations } from "../../operations/useOperations";

const ShoreTrips = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("time");
  const { trips: shoreTrips } = useOperations();
  const visibleTrips = useMemo(() => {
    const query = search.trim().toLowerCase();
    return shoreTrips
      .filter((trip) => [trip.vesselName, trip.ownerName, trip.registrationNumber, trip.shoreApproval].some((value) => value.toLowerCase().includes(query)))
      .sort((a, b) => sort === "vessel" ? a.vesselName.localeCompare(b.vesselName) : a.scheduledDepartureUtc.localeCompare(b.scheduledDepartureUtc));
  }, [search, sort, shoreTrips]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="overflow-hidden rounded-lg bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div><h1 className="text-xl font-semibold text-[#14223d]">Scheduled Trips</h1><p className="mt-1 text-xs text-slate-400">Review and authorize scheduled vessel departures.</p></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-slate-400 focus-within:border-indigo-400">
              <Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="w-full bg-transparent text-sm text-slate-700 outline-none sm:w-44" />
            </label>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400">
              <option value="time">Sort by Time</option><option value="vessel">Sort by Vessel</option>
            </select>
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50/70 text-xs text-slate-500"><tr><th className="px-8 py-4 font-medium">Vessel</th><th className="px-5 py-4 font-medium">Owner</th><th className="px-5 py-4 font-medium">Registration No.</th><th className="px-5 py-4 font-medium">Scheduled Time</th><th className="px-5 py-4 font-medium">Approval</th><th className="px-8 py-4 text-right font-medium">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTrips.map((trip) => <TripRow key={trip.id} trip={trip} onOpen={() => navigate(`/shore/trips/${trip.id}`)} />)}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-slate-100 md:hidden">
          {visibleTrips.map((trip) => (
            <button key={trip.id} type="button" onClick={() => navigate(`/shore/trips/${trip.id}`)} className="block w-full p-5 text-left transition hover:bg-slate-50">
              <div className="flex items-start justify-between gap-3"><strong className="text-sm text-[#14223d]">{trip.vesselName}</strong><Status status={trip.shoreApproval} /></div>
              <p className="mt-2 text-xs text-slate-500">{trip.registrationNumber} · {trip.ownerName}</p><p className="mt-1 text-xs text-slate-400">{formatTripDate(trip.scheduledDepartureUtc)}</p>
            </button>
          ))}
        </div>
        {visibleTrips.length === 0 && <p className="px-8 py-14 text-center text-sm text-slate-400">No trips match your search.</p>}
      </section>
    </main>
  );
};

function TripRow({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  return <tr className="transition hover:bg-slate-50/70"><td className="px-8 py-5 font-medium text-[#14223d]">{trip.vesselName}</td><td className="px-5 py-5 text-slate-600">{trip.ownerName}</td><td className="px-5 py-5 text-slate-600">{trip.registrationNumber}</td><td className="px-5 py-5 text-slate-600">{formatTripDate(trip.scheduledDepartureUtc)}</td><td className="px-5 py-5"><Status status={trip.shoreApproval} /></td><td className="px-8 py-5 text-right"><button type="button" onClick={onOpen} aria-label={`Review ${trip.vesselName}`} className="rounded-full border border-indigo-200 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50">Review</button></td></tr>;
}

function Status({ status }: { status: string }) {
  const color = status === "Approved" ? "text-emerald-600 bg-emerald-50" : status === "Rejected" ? "text-red-600 bg-red-50" : "text-amber-600 bg-amber-50";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${color}`}>{status}</span>;
}

export default ShoreTrips;
