import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { Icon } from "../../components/ui/icon";
import { formatTripDate } from "../../operations/operationsApi";
import { useOperations } from "../../operations/useOperations";

const ShoreDashboard = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { trips: shoreTrips } = useOperations();
  const name = session?.email.split("@")[0] ?? "Shore Officer";
  const currentTrips = shoreTrips.filter((trip) => trip.shoreApproval === "Pending").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
        <section>
          <p className="text-sm font-medium text-slate-700">Hello,</p>
          <h1 className="mt-1 break-words text-3xl font-semibold capitalize text-[#14223d]">{name}!</h1>
          <p className="mt-2 text-xs text-slate-400">Stay in Control, Stay Connected</p>
          <div className="mt-8 rounded-md bg-white px-6 py-7 shadow-sm">
            <h2 className="text-lg font-medium leading-6 text-[#14223d]">What&apos;s<br />New?</h2>
            <div className="mt-5 space-y-2 text-xs">
              <p className="text-slate-400">{currentTrips.toString().padStart(2, "0")} Current Trips</p>
              <p className="text-indigo-600">12 Notifications</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <button type="button" onClick={() => navigate("/shore/trips")} className="group min-h-80 rounded-md bg-white p-8 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Icon name="vessel" size={38} /></div>
            <h2 className="mt-7 text-xl font-medium text-[#14223d]">Trips</h2>
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">Access all upcoming and completed trips requiring shore review.</p>
            <span className="mt-7 inline-block text-xs font-medium text-indigo-700 transition group-hover:translate-x-1">View »</span>
          </button>

          <div className="min-h-80 rounded-md bg-white p-8 shadow-sm">
            <h2 className="text-xl font-medium text-[#14223d]">Upcoming Trips</h2>
            <p className="mt-2 text-xs text-slate-400">Upcoming trip records.</p>
            <div className="mt-5 space-y-3">
              {shoreTrips.slice(0, 3).map((trip) => (
                <button key={trip.id} type="button" onClick={() => navigate(`/shore/trips/${trip.id}`)} className="flex w-full items-center gap-3 rounded-xl bg-indigo-50/80 p-3 text-left transition hover:bg-indigo-100">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-700"><Icon name="vessel" size={23} /></span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-xs text-[#14223d]">{trip.vesselName}</strong><span className="mt-1 block text-[10px] text-slate-500">{formatTripDate(trip.scheduledDepartureUtc)}</span></span>
                  <span className="rounded-full border border-indigo-300 bg-white px-2 py-1 text-[9px] text-indigo-700">Info</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default ShoreDashboard;
