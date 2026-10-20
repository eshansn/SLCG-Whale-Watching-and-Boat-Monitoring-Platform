import { useEffect, useState } from 'react';
import { useAuth } from '../../../auth/useAuth';
import { API_BASE_URL } from '../../../api/httpClient';
import type { CrewCertificate } from '../../BoatCrew/crewApi';

export default function CrewCertificates({ crewId }: { crewId: string }) {
  const { session } = useAuth();
  const token = session?.accessToken;
  const [items, setItems] = useState<CrewCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!token) return;
    fetch(`${API_BASE_URL}/api/admin/crew/${crewId}/certificates`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => { if (!response.ok) throw new Error('Unable to load certificates.'); return response.json() as Promise<CrewCertificate[]>; })
      .then(documents => { if (active) setItems(documents); })
      .catch(reason => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [crewId, token]);
  async function download(item: CrewCertificate) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/crew/${crewId}/certificates/${item.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Unable to download certificate.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = item.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to download certificate.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-3 space-y-2">
    {loading ? <p className="text-sm text-slate-500">Loading certificates...</p> : items.length === 0 ? <p className="text-sm text-slate-500">No uploaded certificates.</p> : items.map(item => <button key={item.id} type="button" disabled={busy} onClick={() => void download(item)} className="block w-full rounded-lg bg-slate-50 p-3 text-left text-sm text-indigo-700 disabled:opacity-50">{item.name} — Download</button>)}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>;
}
