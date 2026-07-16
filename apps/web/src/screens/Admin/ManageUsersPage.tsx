import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/ui/icon";

const ManageUsers = () => {
  const navigate = useNavigate();

  const handleUsersClick = (): void => {
    navigate("/admin/select-users");
  };

  const handleFleetsClick = (): void => {
    navigate("/admin/manage-fleets");
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] font-[Poppins] text-[#14223d]">
      {/* Page Content */}
      <main className="mx-auto max-w-6xl px-8 py-12">
        <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
          {/* Left Section */}
          <aside>
            <p className="text-xs font-medium text-slate-600">manage</p>

            <h1 className="mt-1 text-2xl font-semibold leading-tight text-[#14223d]">
              Users &amp; Fleets
            </h1>

            {/* What's New Card */}
            <div className="mt-8 bg-white px-6 py-7 shadow-sm">
              <h2 className="text-lg font-medium leading-6 text-[#14223d]">
                What&apos;s
                <br />
                New?
              </h2>

              <div className="mt-5 space-y-2 text-[11px]">
                <p className="text-slate-400">99 New Users</p>
                <p className="text-green-500">02 New Boats</p>
              </div>
            </div>
          </aside>

          {/* Cards */}
          <section className="grid gap-10 md:grid-cols-2">
            {/* Users Card */}
            <button
              type="button"
              onClick={handleUsersClick}
              className="
                group
                min-h-[320px]
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
                  name="user"
                  size={36}
                  className="text-[#3145df]"
                />
              </div>

              <h2 className="mt-7 text-xl font-medium text-[#14223d]">
                Users
              </h2>

              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
                Manage user records, including registration details,
                certifications, and account information.
              </p>

              <span className="mt-7 inline-block text-xs font-medium text-indigo-700 transition-transform duration-300 group-hover:translate-x-1">
                Manage »
              </span>
            </button>

            {/* Fleets Card */}
            <button
              type="button"
              onClick={handleFleetsClick}
              className="
                group
                min-h-[320px]
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
                  size={36}
                  className="text-[#3145df]"
                />
              </div>

              <h2 className="mt-7 text-xl font-medium text-[#14223d]">
                Fleets
              </h2>

              <p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">
                Manage vessel records, including registration details and
                operational activity.
              </p>

              <span className="mt-7 inline-block text-xs font-medium text-indigo-700 transition-transform duration-300 group-hover:translate-x-1">
                Manage »
              </span>
            </button>
          </section>
        </div>
      </main>
    </div>
  );
};

export default ManageUsers;
