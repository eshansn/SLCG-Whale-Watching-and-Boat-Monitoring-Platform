import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/ui/icon";
import { useAuth } from "../../auth/useAuth";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const isWildlife = session?.roles.includes("Wildlife") ?? false;

  const handleManageUsers = (): void => {
    navigate("/admin/manage-users");
  };

  const handleManageTrips = (): void => {
    navigate("/admin/trips");
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-[Poppins] text-slate-900">
      {/* Dashboard Content */}
      <main className="mx-auto max-w-6xl px-8 py-12">
        <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
          {/* Left Section */}
          <section>
            <p className="text-sm font-medium text-slate-700">Hello,</p>

            <h1 className="mt-1 text-3xl font-semibold text-[#14223d]">
              {isWildlife ? "Wildlife Authority!" : "Admin!"}
            </h1>

            <p className="mt-2 text-[10px] text-slate-400">
              Stay in Control, Stay Connected
            </p>

            {/* What's New Card */}
            <div className="mt-8 rounded-sm bg-white px-6 py-7 shadow-sm">
              <h2 className="text-lg font-medium leading-6 text-[#14223d]">
                What&apos;s
                <br />
                New?
              </h2>

              <div className="mt-5 space-y-2 text-xs">
                <p className="text-slate-400">10 New Users</p>
                <p className="text-green-500">78 New Trips</p>
                <p className="text-slate-400">05 New Complaints</p>
              </div>
            </div>
          </section>

          {/* Dashboard Cards */}
          <section className="grid gap-10 md:grid-cols-2">
            {/* Manage Users and Fleets Card */}
            <button
              type="button"
              onClick={handleManageUsers}
              className="
                group
                min-h-[340px]
                cursor-pointer
                rounded-sm
                bg-white
                p-10
                text-left
                shadow-sm
                transition-all
                duration-300
                ease-in-out
                hover:scale-105
                hover:shadow-xl
                focus:outline-none
                focus:ring-2
                focus:ring-indigo-500
                focus:ring-offset-2
              "
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-50">
                <Icon
                  name="group"
                  size={40}
                  className="text-[#3145df]"
                />
              </div>

              <h2 className="mt-7 text-xl font-medium text-[#14223d]">
                Manage Users &amp; Boats
              </h2>

              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
                Monitor, update, and manage registered users and boats with ease.
              </p>

              <span className="mt-7 inline-block text-xs font-medium text-indigo-700 transition-transform duration-300 group-hover:translate-x-1">
                Manage »
              </span>
            </button>

            {/* Manage Trips Card */}
            <button
              type="button"
              onClick={handleManageTrips}
              className="
                group
                min-h-[340px]
                cursor-pointer
                rounded-sm
                bg-white
                p-10
                text-left
                shadow-sm
                transition-all
                duration-300
                ease-in-out
                hover:scale-105
                hover:shadow-xl
                focus:outline-none
                focus:ring-2
                focus:ring-indigo-500
                focus:ring-offset-2
              "
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-indigo-50">
                <Icon
                  name="vessel"
                  size={40}
                  className="text-[#3145df]"
                />
              </div>

              <h2 className="mt-7 text-xl font-medium text-[#14223d]">
                Manage Trips
              </h2>

              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
                Stay connected to every journey with instant access to trip
                information.
              </p>

              <span className="mt-7 inline-block text-xs font-medium text-indigo-700 transition-transform duration-300 group-hover:translate-x-1">
                Info »
              </span>
            </button>
          </section>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
