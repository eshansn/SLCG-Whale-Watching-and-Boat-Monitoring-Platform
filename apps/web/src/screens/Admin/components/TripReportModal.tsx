import { useMemo, useState } from 'react';
import { Check, Download, LoaderCircle, Search, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { Boat, Trip } from '../../../operations/operationsApi';

type Period = 'today' | '7' | '30' | '60' | '90' | 'lifetime' | 'custom';
type ApprovalFilter = 'all' | 'approved' | 'not-approved';

interface TripReportModalProps {
  boats: Boat[];
  trips: Trip[];
  loading: boolean;
  onClose: () => void;
}

const periods: Array<[Period, string]> = [
  ['today', 'Today'],
  ['7', 'Last 7 Days'],
  ['30', 'Last 30 Days'],
  ['60', 'Last 60 Days'],
  ['90', 'Last 90 Days'],
  ['lifetime', 'Lifetime'],
  ['custom', 'Custom Period'],
];

const approvalOptions: Array<[ApprovalFilter, string]> = [
  ['all', 'All'],
  ['approved', 'Approved'],
  ['not-approved', 'Not Approved'],
];

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function periodBounds(period: Period, from: string, to: string) {
  if (period === 'lifetime') return undefined;
  if (period === 'custom') {
    if (!from || !to) return undefined;
    return { start: new Date(`${from}T00:00:00`), end: new Date(`${to}T23:59:59.999`) };
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (period !== 'today') start.setDate(start.getDate() - (Number(period) - 1));
  return { start, end };
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-LK', { dateStyle: 'long' }).format(date);
}

async function loadImageAsDataUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load image: ${response.status}`);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function createTripReportPdf({
  trips,
  boats,
  periodLabel,
  approvalLabel,
  boatLabel,
}: {
  trips: Trip[];
  boats: Boat[];
  periodLabel: string;
  approvalLabel: string;
  boatLabel: string;
}) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const margin = 16;
  const contentWidth = 178;
  let y = 42;

  const header = async (firstPage: boolean) => {
    pdf.setFillColor(20, 34, 61);
    pdf.rect(0, 0, 210, firstPage ? 34 : 20, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(firstPage ? 17 : 10);
    pdf.text(firstPage ? 'Trip Report' : 'Trip Report - continued', margin, firstPage ? 14 : 13);
    if (firstPage) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`Period: ${periodLabel}`, margin, 21);
      pdf.text(`Approval: ${approvalLabel}`, margin, 27);
      try {
        const logo = await loadImageAsDataUrl('/SLCG.png');
        pdf.addImage(logo, 'PNG', 139, 5, 55, 24, undefined, 'FAST');
      } catch {
        // Keep report generation available if the brand image cannot load.
      }
    }
    pdf.setTextColor(20, 34, 61);
  };

  await header(true);

  const ensureSpace = async (required: number) => {
    if (y + required <= 280) return;
    pdf.addPage();
    y = 28;
    await header(false);
  };

  const section = async (title: string) => {
    await ensureSpace(14);
    pdf.setFillColor(238, 243, 249);
    pdf.roundedRect(margin, y, contentWidth, 9, 2, 2, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.text(title.toUpperCase(), margin + 4, y + 6);
    y += 13;
  };

  const field = async (label: string, input: unknown) => {
    const value = input == null || String(input).trim() === '' ? '-' : String(input);
    const lines = pdf.splitTextToSize(value, 116) as string[];
    const height = Math.max(7, lines.length * 4.2 + 2);
    await ensureSpace(height);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.3);
    pdf.setTextColor(89, 103, 126);
    pdf.text(label, margin, y + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(20, 34, 61);
    pdf.text(lines, margin + 55, y + 4);
    y += height;
  };

  const approvedCount = trips.filter((trip) => trip.shoreApproval === 'Approved').length;
  await section('Report summary');
  await field('Generated', formatDateTime(new Date().toISOString()));
  await field('Time period', periodLabel);
  await field('Approval filter', approvalLabel);
  await field('Boat filter', boatLabel);
  await field('Trips included', trips.length);
  await field('Approved trips', approvedCount);
  await field('Not approved trips', trips.length - approvedCount);

  await section(`Trip records (${trips.length})`);
  if (!trips.length) await field('Trips', 'No trips match the selected report filters.');
  for (const [index, trip] of trips.entries()) {
    await ensureSpace(24);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, y, margin + contentWidth, y);
    y += 3;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(20, 34, 61);
    pdf.text(`${index + 1}. ${trip.vesselName} | ${trip.registrationNumber}`, margin, y + 4);
    y += 8;
    const boat = boats.find((item) => item.id === trip.boatId);
    await field('Trip reference', trip.id);
    await field('Boat owner', trip.ownerName);
    await field('Scheduled departure', formatDateTime(trip.scheduledDepartureUtc));
    await field('Actual departure', formatDateTime(trip.actualDepartureUtc));
    await field('Actual arrival', formatDateTime(trip.actualArrivalUtc));
    await field('Route', trip.route);
    await field('Passengers', trip.passengerCount);
    await field('Maximum capacity', boat?.maximumCapacity);
    await field('Trip status', trip.status);
    await field('Shore approval', trip.shoreApproval);
    await field('Wildlife Shore approval', trip.wildlifeShoreApproval);
    await field('Boat approval', boat?.approval);
    await field('Wildlife boat approval', boat?.wildlifeApproval);
    await field('Shore notes', trip.shoreNotes);
    await field('Active SOS', trip.hasActiveSos ? 'Yes' : 'No');
    await field('Assigned crew', trip.crew.length ? trip.crew.map((member) => `${member.name} (${member.position}, ${member.certified ? 'Certified' : 'Not certified'})`).join(', ') : 'None recorded');
    await field('Last updated', formatDateTime(trip.updatedAtUtc));
    y += 3;
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(115, 128, 148);
    pdf.text('WWMS Administrative Trip Report', margin, 291);
    pdf.text(`Page ${page} of ${totalPages}`, 194, 291, { align: 'right' });
  }
  pdf.save(`trip-report-${localDateValue(new Date())}.pdf`);
}

export default function TripReportModal({ boats, trips, loading, onClose }: TripReportModalProps) {
  const [period, setPeriod] = useState<Period>('30');
  const [from, setFrom] = useState(() => localDateValue(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => localDateValue(new Date()));
  const [approval, setApproval] = useState<ApprovalFilter>('all');
  const [selectedBoatIds, setSelectedBoatIds] = useState<string[]>([]);
  const [boatSearch, setBoatSearch] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const customInvalid = period === 'custom' && (!from || !to || from > to);
  const selectedBoats = useMemo(() => boats.filter((boat) => selectedBoatIds.includes(boat.id)), [boats, selectedBoatIds]);
  const suggestions = useMemo(() => {
    const query = boatSearch.trim().toLowerCase();
    if (!query) return [];
    return boats.filter((boat) => !selectedBoatIds.includes(boat.id) && `${boat.name} ${boat.registrationNumber} ${boat.ownerName}`.toLowerCase().includes(query)).slice(0, 8);
  }, [boatSearch, boats, selectedBoatIds]);

  const selectedTrips = useMemo(() => {
    const bounds = periodBounds(period, from, to);
    if (period === 'custom' && !bounds) return [];
    return trips.filter((trip) => {
      const scheduled = new Date(trip.scheduledDepartureUtc);
      const inPeriod = !bounds || (scheduled >= bounds.start && scheduled <= bounds.end);
      const hasApproval = approval === 'all' || (approval === 'approved' ? trip.shoreApproval === 'Approved' : trip.shoreApproval !== 'Approved');
      const hasBoat = !selectedBoatIds.length || selectedBoatIds.includes(trip.boatId);
      return inPeriod && hasApproval && hasBoat;
    }).sort((a, b) => new Date(b.scheduledDepartureUtc).getTime() - new Date(a.scheduledDepartureUtc).getTime());
  }, [approval, from, period, selectedBoatIds, to, trips]);

  const periodLabel = period === 'custom'
    ? customInvalid ? 'Custom period' : `${formatDate(from)} to ${formatDate(to)}`
    : periods.find(([value]) => value === period)?.[1] ?? 'Lifetime';
  const approvalLabel = approvalOptions.find(([value]) => value === approval)?.[1] ?? 'All';
  const boatLabel = selectedBoats.length ? selectedBoats.map((boat) => `${boat.name} (${boat.registrationNumber})`).join(', ') : 'Any boat';

  const toggleBoat = (boatId: string) => {
    setSelectedBoatIds((current) => current.includes(boatId) ? current.filter((id) => id !== boatId) : [...current, boatId]);
    setBoatSearch('');
  };

  const download = async () => {
    if (loading || customInvalid) return;
    setDownloading(true);
    setError('');
    try {
      await createTripReportPdf({ trips: selectedTrips, boats, periodLabel, approvalLabel, boatLabel });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the trip report.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="trip-report-title" className="my-4 w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div><h2 id="trip-report-title" className="text-lg font-semibold text-[#14223d]">Download trip report</h2><p className="mt-1 text-sm text-slate-500">Choose the trips to include in the PDF.</p></div>
          <button type="button" onClick={onClose} aria-label="Close report dialog" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"><X size={19}/></button>
        </header>

        <div className="max-h-[72vh] space-y-6 overflow-y-auto p-6">
          <fieldset><legend className="text-sm font-semibold text-[#14223d]">Time period</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{periods.map(([value, label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${period === value ? 'border-[#14223d] bg-[#14223d] text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'}`}>{label}</button>)}</div></fieldset>

          {period === 'custom' && <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">From<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="mt-2 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"/></label><label className="text-xs font-semibold text-slate-600">To<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="mt-2 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-400"/></label></div>}

          <fieldset><legend className="text-sm font-semibold text-[#14223d]">Approval</legend><p className="mt-1 text-xs text-slate-400">Based on the existing Shore approval status.</p><div className="mt-3 grid grid-cols-3 gap-2">{approvalOptions.map(([value, label]) => <button key={value} type="button" onClick={() => setApproval(value)} className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${approval === value ? 'border-[#14223d] bg-[#14223d] text-white' : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'}`}>{label}</button>)}</div></fieldset>

          <fieldset><legend className="text-sm font-semibold text-[#14223d]">Boats</legend><p className="mt-1 text-xs text-slate-400">Leave empty to include any boat, or select multiple boats.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedBoatIds([])} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${!selectedBoatIds.length ? 'border-[#14223d] bg-[#14223d] text-white' : 'border-slate-200 text-slate-600'}`}>Any boat</button>{selectedBoats.map((boat) => <button key={boat.id} type="button" onClick={() => toggleBoat(boat.id)} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">{boat.name}<X size={13}/></button>)}</div>
            <div className="relative mt-3"><Search size={16} className="pointer-events-none absolute left-3 top-3.5 text-slate-400"/><input type="search" value={boatSearch} onChange={(event) => setBoatSearch(event.target.value)} placeholder="Search boat, registration or owner" className="h-11 w-full rounded-lg border border-slate-200 bg-[#f9fbff] pl-10 pr-3 text-sm outline-none focus:border-indigo-400"/>{boatSearch.trim() && <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{suggestions.length ? suggestions.map((boat) => <button key={boat.id} type="button" onClick={() => toggleBoat(boat.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50"><span><b className="block text-sm text-[#14223d]">{boat.name}</b><span className="text-xs text-slate-400">{boat.registrationNumber} · {boat.ownerName}</span></span><Check size={16} className="text-indigo-600"/></button>) : <p className="px-3 py-4 text-sm text-slate-400">No matching boats.</p>}</div>}</div>
          </fieldset>

          <div className="rounded-xl border border-slate-100 bg-[#f9fbff] p-4 text-sm text-slate-600">{loading ? <span className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin"/>Loading the latest trips…</span> : <><b className="text-[#14223d]">{selectedTrips.length}</b> trip{selectedTrips.length === 1 ? '' : 's'} will be included, ordered newest first.</>}</div>
          {customInvalid && <p className="text-sm text-red-600">Select a valid start and end date.</p>}
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600">Cancel</button><button type="button" disabled={loading || downloading || customInvalid} onClick={() => void download()} className="inline-flex items-center gap-2 rounded-lg bg-[#14223d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#22375f] disabled:cursor-not-allowed disabled:opacity-45">{downloading ? <LoaderCircle size={17} className="animate-spin"/> : <Download size={17}/>} {downloading ? 'Creating PDF…' : 'Download PDF'}</button></footer>
      </section>
    </div>
  );
}
