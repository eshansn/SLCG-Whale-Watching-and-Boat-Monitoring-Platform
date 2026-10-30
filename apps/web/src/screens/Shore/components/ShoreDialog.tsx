import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function ShoreDialog({ title, children, onClose, wide = false, busy = false }: {
  title: string; children: ReactNode; onClose: () => void; wide?: boolean; busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node?.showModal();
    return () => { node?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className={`m-auto rounded-2xl bg-white p-4 text-[#14223d] shadow-2xl backdrop:bg-black/70 sm:p-6 ${wide ? 'max-w-xl' : 'max-w-md'}`}
    style={{ width: 'calc(100% - 2rem)', maxHeight: 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 2rem)', overflowY: 'auto', overscrollBehavior: 'contain' }}>
    <div className="mb-4 flex items-start justify-between gap-3"><h2 id={titleId} className="min-w-0 break-words pt-2 text-lg font-semibold">{title}</h2>
      <button type="button" onClick={onClose} disabled={busy} aria-label={`Close ${title}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X size={22} /></button></div>
    {children}
  </dialog>;
}
