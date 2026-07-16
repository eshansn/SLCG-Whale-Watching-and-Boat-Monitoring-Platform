import {
  NavLink,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Icon } from "../../components/ui/icon";

const TripInfo = () => {
  const navigate = useNavigate();

  const { tripId } = useParams<{
    tripId: string;
  }>();

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-[Poppins] text-[#14223D]">
      {/* Navigation Bar */}
      <nav className="hidden" aria-hidden="true">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <button
            type="button"
            onClick={() =>
              navigate("/admin")
            }
            aria-label="Go to admin dashboard"
          >
            <img
              src="/SLCG.png"
              alt="Sri Lanka Coast Guard Logo"
              className="h-10 w-auto object-contain"
            />
          </button>

          <div className="flex items-center gap-8 text-sm text-[#14223D]">
            <button
              type="button"
              aria-label="Notifications"
            >
              <Icon
                name="notification"
                size={21}
              />
            </button>

            <NavLink
              to="/admin/manage-users"
              className="hover:text-indigo-700"
            >
              Users
            </NavLink>

            <NavLink
              to="/admin/manage-fleets"
              className="hover:text-indigo-700"
            >
              Boats
            </NavLink>

            <NavLink
              to="/admin/trips"
              className="font-bold text-indigo-800"
            >
              Trips
            </NavLink>

            <NavLink
              to="/admin/inquiries"
              className="hover:text-indigo-700"
            >
              Inquiries
            </NavLink>

            <NavLink
              to="/admin/settings"
              className="hover:text-indigo-700"
            >
              Settings
            </NavLink>

            <button
              type="button"
              onClick={() =>
                navigate("/login")
              }
              className="rounded-md bg-[#14223D] px-8 py-3 text-sm font-medium text-white hover:bg-[#22375F]"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
        <button
          type="button"
          onClick={() =>
            navigate("/admin/trips")
          }
          className="mb-7 text-sm font-medium text-indigo-700 hover:underline"
        >
          Back to Scheduled Trips
        </button>

        <section className="rounded-lg bg-white p-8 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50">
              <Icon
                name="vessel"
                size={30}
              />
            </div>

            <div>
              <p className="text-xs text-slate-500">
                Trip ID: {tripId}
              </p>

              <h1 className="mt-1 text-2xl font-semibold">
                Trip Information
              </h1>
            </div>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <InfoItem
              label="Vessel"
              value="FV Mirissa King"
            />

            <InfoItem
              label="Owner"
              value="Nimal Perera"
            />

            <InfoItem
              label="Registration Number"
              value="SL-WWB-2047"
            />

            <InfoItem
              label="Scheduled Time"
              value="14 Jul 2026, 06:30 AM"
            />

            <InfoItem
              label="Approval"
              value="Approved"
            />
          </div>
        </section>
      </main>
    </div>
  );
};

interface InfoItemProps {
  label: string;
  value: string;
}

const InfoItem = ({
  label,
  value,
}: InfoItemProps) => {
  return (
    <div className="rounded-md border border-slate-100 bg-[#F9FBFF] p-5">
      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm font-medium text-[#14223D]">
        {value}
      </p>
    </div>
  );
};

export default TripInfo;
