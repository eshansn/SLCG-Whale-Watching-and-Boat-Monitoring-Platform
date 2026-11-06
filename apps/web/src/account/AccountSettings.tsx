import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { supportReturn } from '../support/supportNavigation';
import DeleteAccountDialog, { deletionDescription } from './DeleteAccountDialog';

export default function AccountSettings() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const back = supportReturn(params.get('from'), session);
  const [open, setOpen] = useState(false);
  return <main className="min-h-dvh bg-[#f8f9fb] px-5 py-8 font-[Poppins] text-[#14223d] sm:px-8">
    <div className="mx-auto max-w-2xl">
      <Link to={back.to} className="inline-flex min-h-11 items-center text-sm underline">Back to {back.portal?.label ?? 'portal'}</Link>
      <h1 className="mt-6 text-2xl font-semibold">Account settings</h1>
      <p className="mt-2 break-all text-sm text-slate-500">{session?.email}</p>
      <button type="button" onClick={() => setOpen(true)} className="mt-8 w-full border-y border-slate-200 py-6 text-left hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600">
        <span className="block text-base text-red-600">Delete My Account</span>
        <span className="mt-2 block text-sm text-slate-500">{deletionDescription}</span>
      </button>
    </div>
    {open && <DeleteAccountDialog onClose={() => setOpen(false)} />}
  </main>;
}
