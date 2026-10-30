import type { CrewCertificateStatus } from '../../../operations/operationsApi';

export default function CrewCertificateNotice({ certificate, approved = false }: { certificate?: CrewCertificateStatus; approved?: boolean }) {
  const valid = certificate?.canApprove;
  const title = certificate?.status === 'Valid' ? 'Certificate Available'
    : certificate?.status === 'Missing' ? 'Certificate Missing'
    : certificate?.status === 'Unavailable' ? 'Certificate Unavailable — Re-upload Required'
    : certificate?.status === 'Invalid' ? 'Certificate Invalid — Re-upload Required' : 'Certificate status unavailable';
  return <div className={`mt-3 rounded-lg border p-3 text-sm ${valid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
    <p className="font-semibold">{title}</p>
    <p className="mt-1">{certificate?.message ?? 'Reload records to verify the certificate before approval.'}</p>
    {approved && !valid && <p className="mt-1 font-medium">Manual review required. Existing approval is retained.</p>}
  </div>;
}
