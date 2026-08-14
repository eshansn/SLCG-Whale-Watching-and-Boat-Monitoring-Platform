import { Eye, EyeOff, KeyRound, Save, X } from "lucide-react";
import { useState, type FormEvent } from "react";

import { changePassword } from "../../../auth/authApi";

interface CrewPasswordDialogProps {
  accessToken: string;
  onClose: () => void;
}

const emptyPasswords = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function CrewPasswordDialog({
  accessToken,
  onClose,
}: CrewPasswordDialogProps) {
  const [passwords, setPasswords] = useState(emptyPasswords);
  const [passwordsVisible, setPasswordsVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (passwords.newPassword !== passwords.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const result = await changePassword(
        accessToken,
        passwords.currentPassword,
        passwords.newPassword,
      );
      onClose();
      window.alert(result.message);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to update password.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crew-password-title"
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm"
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between">
          <div className="flex gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-50 text-[#162d54]">
              <KeyRound size={22} />
            </span>
            <div>
              <h2
                id="crew-password-title"
                className="text-xl font-semibold text-[#162d54]"
              >
                Update password
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Choose a strong, unique password.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close password dialog"
            className="rounded-full p-2 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {(
            [
              ["currentPassword", "Current password"],
              ["newPassword", "New password"],
              ["confirmPassword", "Confirm new password"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm font-semibold text-slate-700">
              {label}
              <div className="relative mt-2">
                <input
                  required
                  minLength={12}
                  type={passwordsVisible ? "text" : "password"}
                  autoComplete={
                    key === "currentPassword"
                      ? "current-password"
                      : "new-password"
                  }
                  value={passwords[key]}
                  onChange={(event) =>
                    setPasswords((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  className="h-12 w-full rounded-xl border border-slate-200 px-4 pr-11 font-normal outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                {key === "newPassword" && (
                  <button
                    type="button"
                    onClick={() => setPasswordsVisible((visible) => !visible)}
                    aria-label={
                      passwordsVisible ? "Hide passwords" : "Show passwords"
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {passwordsVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                )}
              </div>
            </label>
          ))}
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Use at least 12 characters with uppercase, lowercase, number, symbol,
          and varied characters.
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#162d54] font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-[#203d6c] disabled:opacity-50"
        >
          <Save size={18} />
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
