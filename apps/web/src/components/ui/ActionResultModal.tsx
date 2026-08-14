import { CheckCircle2, XCircle } from 'lucide-react';

export default function ActionResultModal({ success, action, message, onClose }: {
  success: boolean;
  action: string;
  message?: string;
  onClose: () => void;
}) {
  const title = success ? `${action} successful` : `${action} failed`;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4" role="presentation" onMouseDown={onClose}>
    <section role="dialog" aria-modal="true" aria-labelledby="action-result-title" onMouseDown={event => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-7 text-center shadow-2xl">
      {success ? <CheckCircle2 className="mx-auto text-emerald-600" size={48}/> : <XCircle className="mx-auto text-red-600" size={48}/>}
      <h2 id="action-result-title" className="mt-4 text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message ?? (success ? `The record has been ${action.toLowerCase()}.` : 'The update could not be completed. Please try again.')}</p>
      <button type="button" onClick={onClose} className={`mt-6 w-full rounded-lg px-4 py-2.5 font-semibold text-white ${success ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>Continue</button>
    </section>
  </div>;
}
