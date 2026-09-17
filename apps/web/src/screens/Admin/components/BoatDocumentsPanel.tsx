import { useMemo, useState } from 'react';
import { Download, Eye, History } from 'lucide-react';
import { boatDocumentRequirements } from '../../../operations/boatDocumentRequirements';
import { operationsApi, type BoatDocument } from '../../../operations/operationsApi';

interface Props {
  boatId: string;
  requirementsVersion: number;
  documents: BoatDocument[];
  token: string;
  canReview: boolean;
  onChanged: () => Promise<void> | void;
}

export default function BoatDocumentsPanel({ boatId, requirementsVersion, documents, token, canReview, onChanged }: Props) {
  const [historyType, setHistoryType] = useState<string>();
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string>();
  const [notice, setNotice] = useState('');
  const definitions = useMemo(() => {
    if (requirementsVersion >= 2) return [...boatDocumentRequirements];
    return Array.from(new Map(documents.map((document) => [document.documentType, {
      documentType: document.documentType,
      name: document.name,
      renewable: Boolean(document.expirationDate),
    }])).values());
  }, [documents, requirementsVersion]);

  const openDocument = async (document: BoatDocument, download = false) => {
    const url = await operationsApi.downloadBoatDocument(token, boatId, document.id);
    if (download) {
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.fileName;
      link.click();
    } else window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const review = async (document: BoatDocument, status: 'Approved' | 'Rejected', renewable: boolean) => {
    setSavingId(document.id);
    setNotice('');
    try {
      await operationsApi.reviewBoatDocument(token, boatId, document.id, status,
        renewable ? expiryDates[document.id] : undefined, rejectionReasons[document.id]);
      await onChanged();
      setNotice(`${document.name} was ${status.toLowerCase()}.`);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Document review failed.');
    } finally {
      setSavingId(undefined);
    }
  };

  return <section className="rounded-2xl bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold">Vessel documents</h2>
    <p className="mt-1 text-xs text-slate-500">Current documents, pending renewals, and retained version history.</p>
    {notice && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">{notice}</p>}
    <div className="mt-4 grid gap-4">
      {definitions.map((definition) => {
        const versions = documents.filter((item) => item.documentType === definition.documentType)
          .sort((a, b) => b.version - a.version);
        const pending = versions.find((item) => item.status === 'PendingReview');
        const current = versions.find((item) => item.isCurrent);
        const displayed = pending ?? current ?? versions[0];
        return <article key={definition.documentType} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold">{definition.name}</h3>
              {displayed ? <>
                <p className="mt-1 truncate text-xs text-slate-500">Version {displayed.version} · {displayed.fileName}</p>
                <p className="mt-1 text-xs"><b>Status:</b> {displayed.renewalState.replace(/([A-Z])/g, ' $1').trim()}</p>
                {displayed.expirationDate && <p className="text-xs"><b>Expires:</b> {formatDate(displayed.expirationDate)}</p>}
                {displayed.uploadedBy && <p className="text-xs"><b>Uploaded by:</b> {displayed.uploadedBy}</p>}
                {displayed.verifiedBy && <p className="text-xs"><b>Verified by:</b> {displayed.verifiedBy}</p>}
              </> : <p className="mt-1 text-xs font-medium text-red-600">Required document missing</p>}
            </div>
            {displayed && <div className="flex gap-1">
              <button type="button" onClick={() => void openDocument(displayed)} title="Preview" className="rounded-full p-2 text-indigo-700"><Eye size={18}/></button>
              <button type="button" onClick={() => void openDocument(displayed, true)} title="Download" className="rounded-full p-2 text-indigo-700"><Download size={18}/></button>
            </div>}
          </div>

          {canReview && pending && <div className="mt-4 rounded-lg bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">Pending Wildlife verification</p>
            {definition.renewable && <label className="mt-2 block text-xs font-medium">Expiry date
              <input type="date" min={new Date().toISOString().slice(0, 10)} value={expiryDates[pending.id] ?? ''}
                onChange={(event) => setExpiryDates((current) => ({ ...current, [pending.id]: event.target.value }))}
                className="mt-1 block rounded-lg border bg-white px-3 py-2"/>
            </label>}
            <label className="mt-2 block text-xs font-medium">Rejection/replacement reason
              <input value={rejectionReasons[pending.id] ?? ''} onChange={(event) => setRejectionReasons((current) => ({ ...current, [pending.id]: event.target.value }))}
                placeholder="Required when rejecting" className="mt-1 block w-full rounded-lg border bg-white px-3 py-2"/>
            </label>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={savingId === pending.id || (definition.renewable && !expiryDates[pending.id])}
                onClick={() => void review(pending, 'Approved', definition.renewable)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve document</button>
              <button type="button" disabled={savingId === pending.id || !(rejectionReasons[pending.id] ?? '').trim()}
                onClick={() => void review(pending, 'Rejected', definition.renewable)} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Request replacement</button>
            </div>
          </div>}

          {versions.length > 0 && <button type="button" onClick={() => setHistoryType(historyType === definition.documentType ? undefined : definition.documentType)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700"><History size={14}/>History ({versions.length})</button>}
          {historyType === definition.documentType && <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
            {versions.map((version) => <div key={version.id} className="rounded-lg bg-slate-50 p-3 text-xs">
              <div className="flex justify-between gap-2"><b>Version {version.version}{version.isCurrent ? ' · Current' : ''}</b><button type="button" onClick={() => void openDocument(version)} className="text-indigo-700">View</button></div>
              <p>Uploaded: {formatDate(version.uploadedAtUtc)}</p>
              {version.expirationDate && <p>Expires: {formatDate(version.expirationDate)}</p>}
              <p>Status: {version.renewalState.replace(/([A-Z])/g, ' $1').trim()}</p>
              {version.rejectionReason && <p className="text-red-700">Reason: {version.rejectionReason}</p>}
            </div>)}
          </div>}
        </article>;
      })}
    </div>
  </section>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
