import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/ui/icon";
import { useAuth } from "../../auth/useAuth";

interface UserCategory {
  title: string;
  description: string;
  path: string;
}

const userCategories: UserCategory[] = [
  {
    title: "Staff",
    description:
      "Manage user roles, permissions, and add new staff.",
    path: "/admin/manage-staff",
  },
  {
    title: "Boat Owners",
    description:
      "Manage boat owner records, including registration details and certifications.",
    path: "/admin/manage-boat-owners",
  },
  {
    title: "Boat Crew",
    description:
      "Manage boat crew records, including registration details and certifications.",
    path: "/admin/manage-boat-crew",
  },
];

const SelectUsers = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const visibleCategories = session?.roles.includes("Wildlife")
    ? userCategories.filter((category) => category.title !== "Staff")
    : userCategories;

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-[Poppins] text-[#14223D]">
      <main className="mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl items-center justify-center px-6 py-14 lg:px-10">
        <section className="grid w-full gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visibleCategories.map((category) => (
            <button
              key={category.title}
              type="button"
              onClick={() => navigate(category.path)}
              className="group min-h-[310px] rounded-md bg-white p-8 text-left shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#EEF0FF]">
                <Icon
                  name="user"
                  size={42}
                  className="text-[#3145DF] [&_*]:stroke-[#3145DF] [&_*]:fill-[#3145DF]"
                />
              </div>

              <h2 className="mt-7 text-2xl font-medium">
                {category.title}
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-400">
                {category.description}
              </p>

              <span className="mt-7 inline-block text-sm font-medium text-indigo-700 transition-transform group-hover:translate-x-1">
                Manage »
              </span>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
};

export default SelectUsers;
