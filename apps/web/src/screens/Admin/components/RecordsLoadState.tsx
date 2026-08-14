interface RecordsErrorNoticeProps {
  error?: string;
  onRetry: () => void;
}

export function RecordsErrorNotice({ error, onRetry }: RecordsErrorNoticeProps) {
  if (!error) return null;
  return <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
    <span>{error}</span>
    <button type="button" onClick={onRetry} className="font-semibold text-red-800 underline underline-offset-2">Retry</button>
  </div>;
}

interface RecordUnavailableProps extends RecordsErrorNoticeProps {
  loading: boolean;
  notFound: string;
}

export function RecordUnavailable({ loading, error, onRetry, notFound }: RecordUnavailableProps) {
  return <main className="p-10 text-center">
    {loading ? 'Loading records…' : error ? <div className="mx-auto max-w-xl"><RecordsErrorNotice error={error} onRetry={onRetry}/></div> : notFound}
  </main>;
}
