import { Link } from "react-router-dom";
import { trips } from "../adminData";

export default function TripHistory({ tripIds }: { tripIds: number[] }) {
  const records = trips.filter((trip) => tripIds.includes(trip.id));
  return <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">Trip history</h2>{records.length === 0 ? <p className="mt-5 text-sm text-slate-500">No trips recorded yet.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-3">Trip</th><th>Date</th><th>Route</th><th>Passengers</th><th>Status</th></tr></thead><tbody>{records.map((trip) => <tr key={trip.id} className="border-b border-slate-100"><td className="py-4"><Link className="font-semibold text-indigo-700" to={`/admin/trip-info/${trip.id}`}>#{trip.id}</Link></td><td>{trip.date}</td><td>{trip.route}</td><td>{trip.passengers}</td><td>{trip.status}</td></tr>)}</tbody></table></div>}</section>;
}
