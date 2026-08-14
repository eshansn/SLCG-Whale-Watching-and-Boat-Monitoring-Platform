import { ChevronRight, RefreshCw } from "lucide-react";
import { useState } from "react";

import { useAuth } from "../../auth/useAuth";
import { operationsApi } from "../../operations/operationsApi";
import {
  readPortalPreference,
  type PortalPreference,
  writePortalPreference,
} from "../../settings/portalPreferences";

export default function ShoreSettings() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState(
    () => readPortalPreference(session?.userId, "shore", "notifications"),
  );
  const [autoUpdates, setAutoUpdates] = useState(
    () => readPortalPreference(session?.userId, "shore", "autoUpdates"),
  );
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  const savePreference = (
    preference: PortalPreference,
    value: boolean,
    update: (next: boolean) => void,
  ) => {
    writePortalPreference(session?.userId, "shore", preference, value);
    update(value);
  };

  const refreshData = async () => {
    if (!session) return;
    setRefreshing(true);
    setMessage("");
    setError(false);
    try {
      await Promise.all([
        operationsApi.boats(session.accessToken),
        operationsApi.trips(session.accessToken),
      ]);
      setMessage("Trip data synchronized.");
    } catch (refreshError) {
      setError(true);
      setMessage(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to synchronize trip data.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="overflow-hidden rounded-lg bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
        <header className="border-b border-slate-100 px-6 py-6 sm:px-8">
          <h1 className="text-xl font-semibold text-[#14223d]">Settings</h1>
          <p className="mt-1 text-xs text-slate-400">
            Manage Shore Officer application preferences.
          </p>
        </header>

        <div className="divide-y divide-slate-100 px-6 sm:px-8">
          <SettingToggle
            title="App Notifications"
            detail="Receive shore trip and approval notifications"
            checked={notifications}
            onChange={(value) =>
              savePreference(
                "notifications",
                value,
                setNotifications,
              )
            }
          />
          <SettingToggle
            title="Auto Updates"
            detail="Keep trip records synchronized automatically"
            checked={autoUpdates}
            onChange={(value) =>
              savePreference("autoUpdates", value, setAutoUpdates)
            }
          />
          <button
            type="button"
            onClick={() => void refreshData()}
            disabled={refreshing}
            className="flex w-full items-center justify-between py-5 text-left disabled:opacity-50"
          >
            <span>
              <span className="block text-sm font-medium text-[#14223d]">
                Refresh Data
              </span>
              <span className="mt-1 block text-xs text-slate-400">
                Synchronize trips with the shared database
              </span>
            </span>
            <RefreshCw
              size={18}
              className={`text-slate-400 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
          <a
            href="mailto:support@wwms.test"
            className="flex items-center justify-between py-5"
          >
            <span>
              <span className="block text-sm font-medium text-[#14223d]">
                Need Help?
              </span>
              <span className="mt-1 block text-xs text-slate-400">
                Contact support@wwms.test
              </span>
            </span>
            <ChevronRight size={18} className="text-slate-400" />
          </a>
        </div>

        {message && (
          <p
            role="status"
            className={`mx-6 mb-6 rounded-md px-4 py-3 text-xs sm:mx-8 ${
              error
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {message}
          </p>
        )}
      </section>
    </main>
  );
}

function SettingToggle({
  title,
  detail,
  checked,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-6 py-5">
      <span>
        <span className="block text-sm font-medium text-[#14223d]">
          {title}
        </span>
        <span className="mt-1 block text-xs text-slate-400">{detail}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-11 shrink-0 appearance-none rounded-full bg-slate-200 p-0.5 transition checked:bg-indigo-600 before:block before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow-sm before:transition checked:before:translate-x-5"
      />
    </label>
  );
}
