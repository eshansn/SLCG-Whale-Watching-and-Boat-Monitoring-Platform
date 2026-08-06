import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Mail,
  Camera,
  Menu as MenuIcon,
  Phone,
  Settings,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { ownerProfileApi } from "../../profiles/ownerProfileApi";

import groupIcon from "../../assets/icons/group.svg";
import infoIcon from "../../assets/icons/info.svg";
import notificationIcon from "../../assets/icons/notification.svg";
import userIcon from "../../assets/icons/user.svg";
import vesselIcon from "../../assets/icons/vessel.svg";
import dashboardIcon from "../../assets/icons/dashboard.svg";
import crewIcon from "../../assets/icons/crew.svg";
import tripsIcon from "../../assets/icons/trips.svg";

interface ProfileFormData {
  userName: string;
  displayName: string;
  nicNumber: string;
  email: string;
  phoneNumber: string;
  about: string;
}

interface MenuItem {
  label: string;
  path: string;
  icon?: string;
  type?: "settings";
}

const menuItems: MenuItem[] = [
  {
    label: "Dashboard",
    path: "/owner",
    icon: dashboardIcon,
  },
  {
    label: "Profile",
    path: "/owner/profile",
    icon: userIcon,
  },
  {
    label: "My Crew",
    path: "/owner/crew",
    icon: crewIcon,
  },
  {
    label: "My Boats",
    path: "/owner/boats",
    icon: vesselIcon,
  },
  {
    label: "My Trips",
    path: "/owner/trips",
    icon: tripsIcon,
  },
  {
    label: "Settings",
    path: "/owner/settings",
    type: "settings",
  },
];

function BoatOwnerProfilePage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photoSrc, setPhotoSrc] = useState('/OwnerProfile.png');

  const [isMenuOpen, setIsMenuOpen] =
    useState(false);

  const [formStatus, setFormStatus] =
    useState("");

  const [profileForm, setProfileForm] =
    useState<ProfileFormData>({
      userName: "",
      displayName: "",
      nicNumber: "",
      email: "",
      phoneNumber: "",
      about: "",
    });

  useEffect(() => {
    if (!session) return;
    ownerProfileApi.get(session.accessToken).then((profile) => setProfileForm({
      userName: profile.userName, displayName: profile.displayName, nicNumber: profile.nicNumber ?? '',
      email: profile.email,
      phoneNumber: profile.phoneNumber, about: profile.bio ?? '',
    })).then(() => ownerProfileApi.photo(session.accessToken)).then((url) => {
      if (url) setPhotoSrc((current) => { if (current.startsWith('blob:')) URL.revokeObjectURL(current); return url; });
    }).catch((error) => setFormStatus(error instanceof Error ? error.message : 'Unable to load profile.'));
    return () => setPhotoSrc((current) => { if (current.startsWith('blob:')) URL.revokeObjectURL(current); return '/OwnerProfile.png'; });
  }, [session]);

  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [isMenuOpen]);

  const openPage = (path: string): void => {
    setIsMenuOpen(false);
    navigate(path);
  };

  const handleSubmit = (
    event: FormEvent<HTMLFormElement>,
  ): void => {
    event.preventDefault();

    if (!profileForm.email.trim()) {
      setFormStatus(
        "Please enter your email address.",
      );
      return;
    }

    if (!profileForm.phoneNumber.trim()) {
      setFormStatus(
        "Please enter your phone number.",
      );
      return;
    }

    if (!session) return;
    ownerProfileApi.update(session.accessToken, {
      email: profileForm.email, phoneNumber: profileForm.phoneNumber,
      bio: profileForm.about || undefined,
    }).then(() => setFormStatus("Your profile has been updated successfully."))
      .catch((error) => setFormStatus(error instanceof Error ? error.message : 'Unable to update profile.'));
  };

  return (
    <main className="boat-owner-page min-h-dvh w-full overflow-x-hidden bg-white text-black">
      {/* Top navigation */}
      <header
        className="
          relative z-30 flex w-full
          items-center justify-between
          bg-white px-5 py-5
          sm:px-8 sm:py-6
          lg:px-12 lg:py-7
          xl:px-16
        "
      >
        <button
          type="button"
          aria-label="Open notifications"
          onClick={() =>
            navigate("/owner/notifications")
          }
          className="
            flex h-10 w-10 items-center
            justify-center rounded-full
            transition-colors hover:bg-gray-100
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#162d54]
          "
        >
          <img
            src={notificationIcon}
            alt=""
            aria-hidden="true"
            className="h-6 w-6 sm:h-7 sm:w-7"
          />
        </button>

        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(true)}
          className="
            flex h-11 w-11 items-center
            justify-center rounded-lg
            transition-colors hover:bg-gray-100
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#162d54]
          "
        >
          <MenuIcon
            className="h-8 w-8 sm:h-9 sm:w-9"
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>
      </header>

      {/* Profile form */}
      <form
        onSubmit={handleSubmit}
        className="
          mx-auto flex min-h-[calc(100dvh-84px)]
          w-full max-w-[760px] flex-col
          px-4 pb-4
          sm:min-h-[calc(100dvh-96px)]
          sm:px-8 sm:pb-8
          lg:min-h-[calc(100dvh-104px)]
          lg:px-10 lg:pb-10
        "
      >
        {/* Owner identity */}
        <section
          className="
            flex items-center gap-4
            pb-6 pt-1
            sm:gap-5 sm:pb-8 sm:pt-3
          "
        >
          <button type="button" onClick={() => photoInputRef.current?.click()}
            className="group relative shrink-0 rounded-full" aria-label="Change profile picture">
            <img src={photoSrc} alt={profileForm.displayName || 'Boat owner'}
              className="h-[70px] w-[70px] rounded-full border border-black object-cover sm:h-[88px] sm:w-[88px] lg:h-[96px] lg:w-[96px]" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"><Camera size={24} /></span>
          </button>
          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]; if (!file || !session) return;
              ownerProfileApi.uploadPhoto(session.accessToken, file)
                .then(() => ownerProfileApi.photo(session.accessToken))
                .then((url) => { if (url) setPhotoSrc((current) => { if (current.startsWith('blob:')) URL.revokeObjectURL(current); return url; }); setFormStatus('Profile picture updated.'); })
                .catch((error) => setFormStatus(error instanceof Error ? error.message : 'Unable to upload profile picture.'));
              event.target.value = '';
            }} />

          <h1
            className="
              text-[20px] font-semibold
              leading-[1.6] text-black
              sm:text-[25px]
              lg:text-[28px]
            "
          >
            {profileForm.displayName || 'Boat owner'}
          </h1>
        </section>

        <div className="flex flex-col gap-5 sm:gap-6">
          {/* NIC Number */}
          <div>
            <label
              htmlFor="ownerNic"
              className="
                mb-2 block text-[14px]
                font-semibold leading-[1.6]
                text-[#252525]
                sm:text-[15px]
              "
            >
              NIC No.
            </label>

            <input
              id="ownerNic"
              type="text"
              value={profileForm.nicNumber}
              placeholder="NIC not recorded"
              autoComplete="off"
              readOnly
              aria-readonly="true"
              className="
                min-h-[48px] w-full
                rounded-[12px] border
                border-[#e8e2e2]
                bg-slate-100 px-4
                text-[14px] font-normal
                text-[#555555]
                outline-none
                transition-colors
                placeholder:text-[#adadad]
                focus:border-[#162d54]
                focus:ring-1
                focus:ring-[#162d54]
                sm:min-h-[54px] sm:text-[15px]
              "
            />
            <p className="mt-1 text-xs text-slate-500">Your legal name and NIC cannot be changed after registration.</p>
          </div>


          {/* Email */}
          <div>
            <label
              htmlFor="ownerEmail"
              className="
                mb-2 block text-[14px]
                font-semibold leading-[1.6]
                text-[#252525]
                sm:text-[15px]
              "
            >
              Your Email
            </label>

            <div className="relative">
              <Mail
                className="
                  pointer-events-none absolute
                  left-4 top-1/2 h-5 w-5
                  -translate-y-1/2
                  text-[#aaaaaa]
                "
                strokeWidth={1.6}
                aria-hidden="true"
              />

              <input
                id="ownerEmail"
                type="email"
                value={profileForm.email}
                placeholder="Enter your email"
                autoComplete="email"
                onChange={(event) => {
                  setProfileForm(
                    (currentForm) => ({
                      ...currentForm,
                      email: event.target.value,
                    }),
                  );

                  setFormStatus("");
                }}
                className="
                  min-h-[52px] w-full
                  rounded-[12px] border
                  border-[#e8e2e2]
                  bg-white py-3 pl-12 pr-4
                  text-[14px] font-normal
                  text-[#555555]
                  outline-none
                  transition-colors
                  placeholder:text-[#adadad]
                  focus:border-[#162d54]
                  focus:ring-1
                  focus:ring-[#162d54]
                  sm:min-h-[56px] sm:text-[15px]
                "
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label
              htmlFor="ownerPhone"
              className="
                mb-2 block text-[14px]
                font-semibold leading-[1.6]
                text-[#252525]
                sm:text-[15px]
              "
            >
              Phone Number
            </label>

            <div className="relative">
              <Phone
                className="
                  pointer-events-none absolute
                  left-4 top-1/2 h-5 w-5
                  -translate-y-1/2
                  text-[#aaaaaa]
                "
                strokeWidth={1.6}
                aria-hidden="true"
              />

              <input
                id="ownerPhone"
                type="tel"
                value={profileForm.phoneNumber}
                placeholder="Enter your phone number"
                autoComplete="tel"
                onChange={(event) => {
                  setProfileForm(
                    (currentForm) => ({
                      ...currentForm,
                      phoneNumber:
                        event.target.value,
                    }),
                  );

                  setFormStatus("");
                }}
                className="
                  min-h-[52px] w-full
                  rounded-[12px] border
                  border-[#e8e2e2]
                  bg-white py-3 pl-12 pr-4
                  text-[14px] font-normal
                  text-[#555555]
                  outline-none
                  transition-colors
                  placeholder:text-[#adadad]
                  focus:border-[#162d54]
                  focus:ring-1
                  focus:ring-[#162d54]
                  sm:min-h-[56px] sm:text-[15px]
                "
              />
            </div>
          </div>

          {/* About */}
          <div>
            <label
              htmlFor="ownerAbout"
              className="
                mb-2 block text-[14px]
                font-semibold leading-[1.6]
                text-[#252525]
                sm:text-[15px]
              "
            >
              About
            </label>

            <textarea
              id="ownerAbout"
              rows={2}
              value={profileForm.about}
              placeholder="Write something about yourself"
              onChange={(event) => {
                setProfileForm(
                  (currentForm) => ({
                    ...currentForm,
                    about: event.target.value,
                  }),
                );

                setFormStatus("");
              }}
              className="
                min-h-[48px] w-full
                resize-none rounded-[12px]
                border border-[#e8e2e2]
                bg-white px-4 py-3
                text-[14px] font-normal
                text-[#555555]
                outline-none
                transition-colors
                placeholder:text-[#adadad]
                focus:border-[#162d54]
                focus:ring-1
                focus:ring-[#162d54]
                sm:min-h-[60px] sm:text-[15px]
              "
            />
          </div>
        </div>

        {formStatus && (
          <p
            role="status"
            className="
              mt-4 text-center
              text-[13px] font-medium
              text-[#162d54]
            "
          >
            {formStatus}
          </p>
        )}

        {/* Update button */}
        <button
          type="submit"
          className="
            mt-auto min-h-[56px] w-full
            rounded-[10px] bg-[#080d68]
            px-5 py-3
            text-[15px] font-medium
            text-white
            transition-colors
            hover:bg-[#121a83]
            focus:outline-none
            focus-visible:ring-2
            focus-visible:ring-[#080d68]
            focus-visible:ring-offset-2
            sm:mt-12 sm:max-w-[420px]
            sm:self-center
          "
        >
          Update
        </button>
      </form>

      {/* Side menu */}
      {isMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() =>
              setIsMenuOpen(false)
            }
            className="
              fixed inset-0 z-40
              border-0 bg-black/25
            "
          />

          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Boat owner menu"
            className="
              fixed right-0 top-0 z-50
              min-h-dvh w-full
              overflow-y-auto bg-white
              px-8 pb-10 pt-5
              shadow-[-8px_0_24px_rgba(0,0,0,0.16)]
              sm:w-[390px] sm:px-10
              lg:w-[430px] lg:px-12
            "
          >
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() =>
                  setIsMenuOpen(false)
                }
                className="
                  flex h-10 w-10
                  items-center justify-center
                  rounded-full
                  transition-colors
                  hover:bg-gray-100
                  focus:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[#162d54]
                "
              >
                <X
                  className="h-6 w-6"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>
            </div>

            <nav
              aria-label="Boat owner navigation"
              className="mt-8 flex flex-col gap-2"
            >
              {menuItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() =>
                    openPage(item.path)
                  }
                  className={`
                    flex w-full items-center gap-6
                    rounded-xl px-3 py-4
                    text-left transition-colors
                    hover:bg-gray-100
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#162d54]
                    ${
                      item.path ===
                      "/owner/profile"
                        ? "bg-gray-100 text-[#162d54]"
                        : "text-black"
                    }
                  `}
                >
                  {item.type === "settings" ? (
                    <Settings
                      className="h-8 w-8 shrink-0"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  ) : (
                    <img
                      src={item.icon}
                      alt=""
                      aria-hidden="true"
                      className="
                        h-8 w-8 shrink-0
                        object-contain
                      "
                    />
                  )}

                  <span className="text-[17px] font-semibold">
                    {item.label}
                  </span>
                </button>
              ))}
            </nav>
          </aside>
        </>
      )}
    </main>
  );
}

export default BoatOwnerProfilePage;
