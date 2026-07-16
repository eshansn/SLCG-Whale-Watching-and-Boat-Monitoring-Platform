import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChangeEvent, FormEvent } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Icon } from "../../components/ui/icon";

export type StaffRole =
  | "Admin"
  | "OPS Room"
  | "SLCG HQ"
  | "Wildlife"
  | "Tourism";

type SortOption =
  | "role"
  | "name-asc"
  | "name-desc"
  | "role-asc"
  | "role-desc"
  | "newest"
  | "oldest";

export interface StaffMember {
  id: number;
  username: string;
  role: StaffRole;
  phoneNumber: string;
  email: string;
  createdAt: string;
}

interface NewStaffForm {
  username: string;
  role: StaffRole;
  email: string;
  password: string;
  confirmPassword: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  0: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

export const initialStaffMembers: StaffMember[] = [
  {
    id: 1,
    username: "Nimal Perera",
    role: "Admin",
    phoneNumber: "077 123 1234",
    email: "nimal.perera@gmail.com",
    createdAt: "2026-07-14T08:30:00",
  },
  {
    id: 2,
    username: "Kasun Silva",
    role: "OPS Room",
    phoneNumber: "071 456 7890",
    email: "kasun.silva@gmail.com",
    createdAt: "2026-07-13T09:15:00",
  },
  {
    id: 3,
    username: "Amal Fernando",
    role: "SLCG HQ",
    phoneNumber: "076 987 6543",
    email: "amal.fernando@gmail.com",
    createdAt: "2026-07-12T10:45:00",
  },
  {
    id: 4,
    username: "Dilan Kumara",
    role: "Wildlife",
    phoneNumber: "075 345 6789",
    email: "dilan.kumara@gmail.com",
    createdAt: "2026-07-11T12:20:00",
  },
  {
    id: 5,
    username: "Ruwan Jayasinghe",
    role: "Tourism",
    phoneNumber: "077 555 2345",
    email: "ruwan.jayasinghe@gmail.com",
    createdAt: "2026-07-10T14:00:00",
  },
  {
    id: 6,
    username: "Chaminda Silva",
    role: "Admin",
    phoneNumber: "071 222 4567",
    email: "chaminda.silva@gmail.com",
    createdAt: "2026-07-09T15:10:00",
  },
  {
    id: 7,
    username: "Tharindu Fernando",
    role: "OPS Room",
    phoneNumber: "076 334 5566",
    email: "tharindu.fernando@gmail.com",
    createdAt: "2026-07-08T11:35:00",
  },
  {
    id: 8,
    username: "Kamal Perera",
    role: "Wildlife",
    phoneNumber: "072 678 4567",
    email: "kamal.perera@gmail.com",
    createdAt: "2026-07-07T08:50:00",
  },
  {
    id: 9,
    username: "Sunil Kumara",
    role: "Tourism",
    phoneNumber: "075 889 3344",
    email: "sunil.kumara@gmail.com",
    createdAt: "2026-07-06T13:40:00",
  },
  {
    id: 10,
    username: "Nuwan Silva",
    role: "SLCG HQ",
    phoneNumber: "077 990 1122",
    email: "nuwan.silva@gmail.com",
    createdAt: "2026-07-05T16:25:00",
  },
];

const emptyStaffForm: NewStaffForm = {
  username: "",
  role: "Admin",
  email: "",
  password: "",
  confirmPassword: "",
};

const ITEMS_PER_PAGE = 5;

const ManageStaff = () => {
  const navigate = useNavigate();

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => {
    try {
      const saved = localStorage.getItem("admin-staff-records-v1");
      return saved ? JSON.parse(saved) as StaffMember[] : initialStaffMembers;
    } catch {
      return initialStaffMembers;
    }
  });

  useEffect(() => {
    localStorage.setItem("admin-staff-records-v1", JSON.stringify(staffMembers));
  }, [staffMembers]);

  const [searchValue, setSearchValue] = useState("");
  const [sortOption, setSortOption] =
    useState<SortOption>("role");
  const [currentPage, setCurrentPage] = useState(1);
  const [isListening, setIsListening] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const [newStaff, setNewStaff] =
    useState<NewStaffForm>(emptyStaffForm);

  const filteredAndSortedStaff = useMemo(() => {
    const searchTerm = searchValue.trim().toLowerCase();

    const filteredStaff = staffMembers.filter((staff) => {
      return (
        staff.username.toLowerCase().includes(searchTerm) ||
        staff.role.toLowerCase().includes(searchTerm) ||
        staff.phoneNumber.toLowerCase().includes(searchTerm) ||
        staff.email.toLowerCase().includes(searchTerm)
      );
    });

    return [...filteredStaff].sort((firstStaff, secondStaff) => {
      switch (sortOption) {
        case "name-asc":
          return firstStaff.username.localeCompare(
            secondStaff.username,
          );

        case "name-desc":
          return secondStaff.username.localeCompare(
            firstStaff.username,
          );

        case "role-asc":
          return firstStaff.role.localeCompare(secondStaff.role);

        case "role-desc":
          return secondStaff.role.localeCompare(firstStaff.role);

        case "newest":
          return (
            new Date(secondStaff.createdAt).getTime() -
            new Date(firstStaff.createdAt).getTime()
          );

        case "oldest":
          return (
            new Date(firstStaff.createdAt).getTime() -
            new Date(secondStaff.createdAt).getTime()
          );

        case "role":
        default:
          return (
            firstStaff.role.localeCompare(secondStaff.role) ||
            firstStaff.username.localeCompare(secondStaff.username)
          );
      }
    });
  }, [staffMembers, searchValue, sortOption]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSortedStaff.length / ITEMS_PER_PAGE),
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const visibleStaffMembers = filteredAndSortedStaff.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );

  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    setSearchValue(event.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ): void => {
    setSortOption(event.target.value as SortOption);
    setCurrentPage(1);
  };

  const handleVoiceSearch = (): void => {
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      window.alert(
        "Voice search is not supported in this browser. Please use Chrome or Edge.",
      );
      return;
    }

    const recognition = new SpeechRecognitionAPI();

    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);

      window.alert(
        "Voice recognition was unsuccessful. Please try again.",
      );
    };

    recognition.onresult = (
      event: SpeechRecognitionEvent,
    ) => {
      const spokenText = event.results[0][0].transcript;

      setSearchValue(spokenText);
      setCurrentPage(1);
    };

    recognition.start();
  };

  const handleStaffInfo = (staffId: number): void => {
    navigate(`/admin/staff-info/${staffId}`);
  };

  const handleDeleteStaff = (staffId: number): void => {
    const selectedStaff = staffMembers.find(
      (staff) => staff.id === staffId,
    );

    if (!selectedStaff) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${selectedStaff.username}"?`,
    );

    if (!confirmed) {
      return;
    }

    setStaffMembers((previousStaff) =>
      previousStaff.filter((staff) => staff.id !== staffId),
    );
  };

  const handleFormChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ): void => {
    const { name, value } = event.target;

    setNewStaff((previousStaff) => ({
      ...previousStaff,
      [name]: value,
    }));

    setFormError("");
  };

  const handleAddStaff = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    const username = newStaff.username.trim();
    const email = newStaff.email.trim();

    if (!username || !email || !newStaff.password || !newStaff.confirmPassword) {
      setFormError("Please complete all fields.");
      return;
    }

    if (newStaff.password.length < 8) {
      setFormError("Password must contain at least 8 characters.");
      return;
    }

    if (newStaff.password !== newStaff.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    const emailExists = staffMembers.some(
      (staff) =>
        staff.email.toLowerCase() === email.toLowerCase(),
    );

    if (emailExists) {
      setFormError(
        "A staff member with this email already exists.",
      );
      return;
    }

    const createdStaff: StaffMember = {
      id: Date.now(),
      username,
      role: newStaff.role,
      phoneNumber: "Not provided",
      email,
      createdAt: new Date().toISOString(),
    };

    setStaffMembers((previousStaff) => [
      createdStaff,
      ...previousStaff,
    ]);

    setNewStaff(emptyStaffForm);
    setSearchValue("");
    setSortOption("newest");
    setCurrentPage(1);
    setFormError("");
    setIsModalOpen(false);
  };

  const handleCloseModal = (): void => {
    setIsModalOpen(false);
    setNewStaff(emptyStaffForm);
    setFormError("");
  };

  const getPaginationItems = (): Array<number | "..."> => {
    if (totalPages <= 5) {
      return Array.from(
        { length: totalPages },
        (_, index) => index + 1,
      );
    }

    if (currentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }

    if (currentPage >= totalPages - 2) {
      return [
        1,
        "...",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages,
    ];
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] font-[Poppins] text-[#14223D]">
      {/* Admin Navbar */}
      <nav className="hidden" aria-hidden="true">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
          <button
            type="button"
            onClick={() => navigate("/admin")}
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
              className="transition-colors hover:text-indigo-700"
            >
              <Icon name="notification" size={21} />
            </button>

            <NavLink
              to="/admin/manage-users"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Users
            </NavLink>

            <NavLink
              to="/admin/manage-fleets"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Boats
            </NavLink>

            <NavLink
              to="/admin/trips"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Trips
            </NavLink>

            <NavLink
              to="/admin/inquiries"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Inquiries
            </NavLink>

            <NavLink
              to="/admin/settings"
              className={({ isActive }) =>
                isActive
                  ? "font-bold text-indigo-800"
                  : "font-normal hover:text-indigo-700"
              }
            >
              Settings
            </NavLink>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="rounded-md bg-[#14223D] px-8 py-3 text-sm font-medium text-white transition-colors hover:bg-[#22375F]"
            >
              Log Out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
        <section className="rounded-lg bg-white px-8 py-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          {/* Header */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-xl font-semibold">Staff</h1>

            <div className="flex w-full flex-col gap-4 sm:flex-row lg:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-[320px]">
                <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                  <Icon name="search" size={18} />
                </div>

                <input
                  type="search"
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder="Search"
                  aria-label="Search staff"
                  className="h-11 w-full rounded-md border border-slate-100 bg-[#F9FBFF] pl-10 pr-12 text-xs text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <button
                  type="button"
                  onClick={handleVoiceSearch}
                  aria-label="Search using microphone"
                  title={
                    isListening
                      ? "Listening..."
                      : "Search using microphone"
                  }
                  className={`absolute inset-y-0 right-3 flex items-center transition-colors ${
                    isListening
                      ? "text-[#FF0000]"
                      : "text-slate-500 hover:text-indigo-700"
                  }`}
                >
                  <Icon name="mic" size={18} />
                </button>
              </div>

              {/* Sort */}
              <div className="flex h-11 min-w-[190px] items-center rounded-md bg-[#F9FBFF] px-4">
                <span className="whitespace-nowrap text-xs text-slate-500">
                  Sort by:
                </span>

                <select
                  value={sortOption}
                  onChange={handleSortChange}
                  aria-label="Sort staff"
                  className="w-full cursor-pointer border-none bg-[#F9FBFF] pl-2 pr-6 text-xs font-semibold text-[#14223D] outline-none"
                >
                  <option value="role">Role</option>
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="role-asc">Role A–Z</option>
                  <option value="role-desc">Role Z–A</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-medium text-slate-500">
                  <th className="w-[60px] px-4 py-4">User</th>
                  <th className="px-4 py-4">Username</th>
                  <th className="px-4 py-4">Role</th>
                  <th className="px-4 py-4">Phone Number</th>
                  <th className="px-4 py-4">Email</th>
                  <th className="px-4 py-4 text-center">Actions</th>
                </tr>
              </thead>

              <tbody>
                {visibleStaffMembers.map((staff) => (
                  <tr
                    key={staff.id}
                    className="border-b border-slate-100 text-xs transition-colors hover:bg-[#F9FBFF]"
                  >
                    <td className="px-4 py-5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
                        <Icon name="user" size={20} />
                      </div>
                    </td>

                    <td className="px-4 py-5 font-medium">
                      {staff.username}
                    </td>

                    <td className="px-4 py-5 text-slate-600">
                      {staff.role}
                    </td>

                    <td className="px-4 py-5 text-slate-600">
                      {staff.phoneNumber}
                    </td>

                    <td className="px-4 py-5">
                      <a
                        href={`mailto:${staff.email}`}
                        className="text-[#14223D] underline transition-colors hover:text-indigo-700"
                      >
                        {staff.email}
                      </a>
                    </td>

                    <td className="px-4 py-5">
                      <div className="flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() => handleStaffInfo(staff.id)}
                          aria-label={`View ${staff.username} information`}
                          title="View staff information"
                          className="flex h-9 w-9 items-center justify-center text-[#14223D] transition-transform hover:scale-110"
                        >
                          <Icon
                            name="info"
                            size={24}
                            className="[&_*]:stroke-[#14223D] [&_*]:stroke-[2.7]"
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(staff.id)}
                          aria-label={`Delete ${staff.username}`}
                          title="Delete staff member"
                          className="flex h-9 w-9 items-center justify-center text-[#FF0000] transition-transform hover:scale-110"
                        >
                          <Icon
                            name="delete"
                            size={20}
                            className="text-[#FF0000] [&_*]:stroke-[#FF0000] [&_*]:fill-[#FF0000]"
                          />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleStaffMembers.length === 0 && (
            <div className="py-16 text-center">
              <Icon name="search" size={30} className="mx-auto" />

              <h2 className="mt-4 text-sm font-semibold">
                No staff members found
              </h2>

              <p className="mt-2 text-xs text-slate-500">
                Try searching by name, role, phone number, or email.
              </p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="mt-8 flex flex-col gap-5 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="rounded-md bg-[#14223D] px-9 py-3 text-sm font-medium text-white transition-colors hover:bg-[#22375F]"
            >
              Add new
            </button>

            {/* Pagination */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() =>
                  setCurrentPage((page) => Math.max(page - 1, 1))
                }
                aria-label="Previous page"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F4F5F7] text-sm text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>

              {getPaginationItems().map((item, index) =>
                item === "..." ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="flex h-8 min-w-6 items-center justify-center text-xs font-semibold"
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCurrentPage(item)}
                    aria-current={
                      currentPage === item ? "page" : undefined
                    }
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-xs ${
                      currentPage === item
                        ? "bg-[#14223D] font-semibold text-white"
                        : "bg-[#F4F5F7] text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((page) =>
                    Math.min(page + 1, totalPages),
                  )
                }
                aria-label="Next page"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#F4F5F7] text-sm text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) handleCloseModal(); }}>
          <div className="w-full max-w-lg rounded-xl bg-white p-7 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Add New Staff
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Enter the staff member details.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCloseModal}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleAddStaff}
              className="mt-7 space-y-5"
            >
              <div>
                <label
                  htmlFor="username"
                  className="mb-2 block text-xs font-medium text-slate-700"
                >
                  Username
                </label>

                <input
                  id="username"
                  name="username"
                  type="text"
                  value={newStaff.username}
                  onChange={handleFormChange}
                  placeholder="Enter username"
                  className="h-11 w-full rounded-md border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label
                  htmlFor="role"
                  className="mb-2 block text-xs font-medium text-slate-700"
                >
                  Role
                </label>

                <select
                  id="role"
                  name="role"
                  value={newStaff.role}
                  onChange={handleFormChange}
                  className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Admin">Admin</option>
                  <option value="OPS Room">OPS Room</option>
                  <option value="SLCG HQ">SLCG HQ</option>
                  <option value="Wildlife">Wildlife</option>
                  <option value="Tourism">Tourism</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="phoneNumber"
                  className="mb-2 block text-xs font-medium text-slate-700"
                >
                  Password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  value={newStaff.password}
                  onChange={handleFormChange}
                  placeholder="Minimum 8 characters"
                  className="h-11 w-full rounded-md border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-xs font-medium text-slate-700">Confirm password</label>
                <input id="confirmPassword" name="confirmPassword" type="password" value={newStaff.confirmPassword} onChange={handleFormChange} placeholder="Re-enter password" className="h-11 w-full rounded-md border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-xs font-medium text-slate-700"
                >
                  Email
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={newStaff.email}
                  onChange={handleFormChange}
                  placeholder="Enter email address"
                  className="h-11 w-full rounded-md border border-slate-200 px-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {formError && (
                <p className="rounded-md bg-red-50 px-4 py-3 text-xs text-red-600">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-md border border-slate-200 px-6 py-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-md bg-[#14223D] px-6 py-3 text-xs font-medium text-white hover:bg-[#22375F]"
                >
                  Add staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStaff;
