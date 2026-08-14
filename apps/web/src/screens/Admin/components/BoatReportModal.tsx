import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, LoaderCircle, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { operationsApi, type Boat, type BoatDocument, type Trip } from '../../../operations/operationsApi';
import type { BoatRecord, CrewRecord, OwnerRecord } from '../adminData';

type Period = 'today' | '7' | '30' | '60' | '90' | 'lifetime' | 'custom';

interface BoatReportModalProps {
  boat: BoatRecord;
  owner?: OwnerRecord;
  crew: CrewRecord[];
  token: string;
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

function localDateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function periodBounds(period: Period, from: string, to: string) {
  if (period === 'lifetime') return undefined;
  if (period === 'custom') {
    if (!from || !to) return undefined;
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T23:59:59.999`);
    return { start, end };
  }
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  if (period !== 'today') start.setDate(start.getDate() - (Number(period) - 1));
  return { start, end };
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-LK', { dateStyle: 'long' }).format(date);
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

interface PdfImage {
  dataUrl: string;
  width: number;
  height: number;
}

async function preparePdfImage(source: string): Promise<PdfImage> {
  const dataUrl = source.startsWith('data:image/') ? source : await loadImageAsDataUrl(source);
  if (!dataUrl.startsWith('data:image/')) throw new Error('The attachment is not an image.');
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error('Unable to read the attached image.'));
    element.src = dataUrl;
  });
  const maximumWidth = 1800;
  const maximumHeight = 2200;
  const scale = Math.min(1, maximumWidth / image.naturalWidth, maximumHeight / image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare the attached image.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), width, height };
}

async function loadCertificateImage(token: string, boatId: string, documentRecord: BoatDocument) {
  if (!documentRecord.contentType.toLowerCase().startsWith('image/')) return undefined;
  const objectUrl = await operationsApi.downloadBoatDocument(token, boatId, documentRecord.id);
  try {
    return await preparePdfImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function createBoatReportPdf({
  boat,
  apiBoat,
  owner,
  crew,
  trips,
  periodLabel,
  token,
}: {
  boat: BoatRecord;
  apiBoat?: Boat;
  owner?: OwnerRecord;
  crew: CrewRecord[];
  trips: Trip[];
  periodLabel: string;
  token: string;
}) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const pageWidth = 210;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 43;

  const addHeader = async (firstPage: boolean) => {
    pdf.setFillColor(20, 34, 61);
    pdf.rect(0, 0, pageWidth, firstPage ? 35 : 20, 'F');
    if (firstPage) {
      try {
        const logo = await loadImageAsDataUrl('/SLCG.png');
        pdf.addImage(logo, 'PNG', 139, 5, 55, 25, undefined, 'FAST');
      } catch {
        // Report generation remains available if the local brand image cannot load.
      }
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(17);
      pdf.text('Boat Information Report', margin, 14);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.text(`${boat.name} | ${boat.registrationNumber}`, margin, 21);
      pdf.text(`Trip period: ${periodLabel}`, margin, 27);
    } else {
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text(`${boat.name} - Boat Information Report`, margin, 13);
    }
    pdf.setTextColor(20, 34, 61);
  };

  await addHeader(true);

  const ensureSpace = (required: number) => {
    if (y + required <= 280) return false;
    pdf.addPage();
    y = 28;
    return true;
  };

  const startSectionPage = async () => {
    pdf.addPage();
    y = 28;
    await addHeader(false);
  };

  const section = async (title: string) => {
    if (ensureSpace(14)) await addHeader(false);
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
    if (ensureSpace(height)) await addHeader(false);
    pdf.setFontSize(8.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(89, 103, 126);
    pdf.text(label, margin, y + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(20, 34, 61);
    pdf.text(lines, margin + 55, y + 4);
    y += height;
  };

  const subsection = async (title: string) => {
    if (ensureSpace(10)) await addHeader(false);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(20, 34, 61);
    pdf.text(title, margin, y + 4);
    pdf.setDrawColor(214, 222, 234);
    pdf.line(margin, y + 7, margin + contentWidth, y + 7);
    y += 11;
  };

  const attachedImage = async (label: string, image: PdfImage | undefined, maximumHeight = 110) => {
    if (!image) {
      await field(label, 'No image attached');
      return;
    }
    const scale = Math.min(contentWidth / image.width, maximumHeight / image.height);
    const imageWidth = image.width * scale;
    const imageHeight = image.height * scale;
    if (ensureSpace(imageHeight + 14)) await addHeader(false);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(89, 103, 126);
    pdf.text(label, margin, y + 4);
    y += 7;
    const imageX = margin + (contentWidth - imageWidth) / 2;
    pdf.setDrawColor(214, 222, 234);
    pdf.roundedRect(imageX - 2, y - 2, imageWidth + 4, imageHeight + 4, 2, 2, 'S');
    pdf.addImage(image.dataUrl, 'JPEG', imageX, y, imageWidth, imageHeight, undefined, 'FAST');
    y += imageHeight + 7;
  };

  await section('Vessel details');
  await field('Boat name', apiBoat?.name ?? boat.name);
  await field('Registration number', apiBoat?.registrationNumber ?? boat.registrationNumber);
  await field('Registration date', formatDate(apiBoat?.registrationDate ?? boat.registrationDate));
  await field('Hull number', apiBoat?.hullNumber ?? boat.hullNumber);
  await field('Length', apiBoat ? `${apiBoat.lengthMeters} m` : boat.length);
  await field('Width', apiBoat ? `${apiBoat.widthMeters} m` : boat.width);
  await field('Maximum speed', apiBoat ? `${apiBoat.maximumSpeedKnots} knots` : '-');
  await field('Maximum capacity', apiBoat?.maximumCapacity ?? boat.capacity);
  await field('Life jackets', apiBoat?.lifeJacketCount ?? '-');
  await field('GPS device ID', apiBoat?.gpsDeviceId ?? '-');
  await field('Administrative approval', apiBoat?.approval ?? boat.approval);
  await field('Wildlife approval', apiBoat?.wildlifeApproval ?? '-');
  await field('Boat record ID', apiBoat?.id ?? boat.apiId ?? boat.id);

  const boatImageSource = apiBoat?.imageUrl ?? boat.imageUrl;
  const boatImage = boatImageSource
    ? await preparePdfImage(boatImageSource).catch(() => undefined)
    : undefined;
  const vesselImageHeight = Math.max(24, Math.min(78, 266 - y));
  await attachedImage('Vessel photograph', boatImage, vesselImageHeight);

  await startSectionPage();
  await section('Boat owner and crew details');
  await subsection('Registered owner');
  await field('Name', owner?.name);
  await field('NIC', owner?.nic);
  await field('Email', owner?.email);
  await field('Phone', owner?.phone);
  await field('Address / profile', owner?.address);
  await field('Owner record ID', owner?.apiId ?? owner?.id);

  await subsection(`Crew under owner (${crew.length})`);
  if (!crew.length) await field('Crew', 'No crew members are registered under this owner.');
  for (const member of crew) {
    await field(member.name, `${member.role} | NIC: ${member.nic || '-'} | Email: ${member.email || '-'} | Phone: ${member.phone || '-'} | Certification: ${member.approval}`);
  }

  const documents = apiBoat?.documents ?? boat.documents ?? [];
  await startSectionPage();
  await section(`Certificates and documents (${documents.length})`);
  if (!documents.length) await field('Certificates', 'No image attached');
  for (const document of documents) {
    const certificateImage = apiBoat
      ? await loadCertificateImage(token, apiBoat.id, document).catch(() => undefined)
      : undefined;
    await attachedImage(document.name, certificateImage);
  }

  await startSectionPage();
  await section(`Trip history (${trips.length})`);
  if (!trips.length) await field('Trips', `No trips were recorded for ${periodLabel}.`);
  for (const [index, trip] of trips.entries()) {
    if (ensureSpace(20)) await addHeader(false);
    pdf.setDrawColor(214, 222, 234);
    pdf.line(margin, y, margin + contentWidth, y);
    y += 3;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(20, 34, 61);
    pdf.text(`Trip ${index + 1} | ${trip.id}`, margin, y + 4);
    y += 8;
    await field('Scheduled departure', formatDateTime(trip.scheduledDepartureUtc));
    await field('Actual departure', formatDateTime(trip.actualDepartureUtc));
    await field('Actual arrival', formatDateTime(trip.actualArrivalUtc));
    await field('Route', trip.route);
    await field('Passenger count', trip.passengerCount);
    await field('Status', trip.status);
    await field('Shore approval', trip.shoreApproval);
    await field('Wildlife Shore approval', trip.wildlifeShoreApproval);
    await field('Shore notes', trip.shoreNotes);
    await field('Active SOS', trip.hasActiveSos ? 'Yes' : 'No');
    await field('Assigned crew', trip.crew.length ? trip.crew.map((member) => `${member.name} (${member.position}, ${member.certified ? 'Certified' : 'Not certified'})`).join(', ') : 'None recorded');
    await field('Last updated', formatDateTime(trip.updatedAtUtc));
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(115, 128, 148);
    pdf.text(`Generated ${formatDateTime(new Date().toISOString())}`, margin, 291);
    pdf.text(`Page ${page} of ${totalPages}`, 194, 291, { align: 'right' });
  }

  const safeRegistration = boat.registrationNumber.replace(/[^a-z0-9_-]+/gi, '-');
  pdf.save(`${safeRegistration}-boat-report.pdf`);
}

export default function BoatReportModal({ boat, owner, crew, token, onClose }: BoatReportModalProps) {
  const [period, setPeriod] = useState<Period>('30');
  const [from, setFrom] = useState(() => localDateValue(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(() => localDateValue(new Date()));
  const [apiBoat, setApiBoat] = useState<Boat>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([operationsApi.boats(token), operationsApi.trips(token)])
      .then(([boats, allTrips]) => {
        if (!active) return;
        setApiBoat(boats.find((item) => item.id === boat.apiId));
        setTrips(allTrips.filter((trip) => trip.boatId === boat.apiId));
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the report data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [boat.apiId, token]);

  const customInvalid = period === 'custom' && (!from || !to || from > to);
  const selectedTrips = useMemo(() => {
    const bounds = periodBounds(period, from, to);
    if (period === 'custom' && !bounds) return [];
    return trips
      .filter((trip) => {
        if (!bounds) return true;
        const scheduled = new Date(trip.scheduledDepartureUtc);
        return scheduled >= bounds.start && scheduled <= bounds.end;
      })
      .sort((a, b) => new Date(b.scheduledDepartureUtc).getTime() - new Date(a.scheduledDepartureUtc).getTime());
  }, [from, period, to, trips]);

  const periodLabel = period === 'custom'
    ? customInvalid ? 'Custom period' : `${formatDate(from)} to ${formatDate(to)}`
    : periods.find(([value]) => value === period)?.[1] ?? 'Lifetime';

  const download = async () => {
    if (customInvalid || loading) return;
    setDownloading(true);
    setError('');
    try {
      await createBoatReportPdf({ boat, apiBoat, owner, crew, trips: selectedTrips, periodLabel, token });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create the PDF report.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="boat-report-title" className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="boat-report-title" className="text-lg font-semibold text-[#14223d]">Download boat information</h2>
            <p className="mt-1 text-sm text-slate-500">{boat.name} · {boat.registrationNumber}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close report dialog" className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"><X size={19}/></button>
        </header>

        <div className="p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#14223d]"><CalendarDays size={18}/> Trip history period</div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {periods.map(([value, label]) => (
              <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${period === value ? 'border-[#14223d] bg-[#14223d] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700'}`}>{label}</button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="mt-5 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">From<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} className="mt-2 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-[#14223d] outline-none focus:border-indigo-400"/></label>
              <label className="text-xs font-semibold text-slate-600">To<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} className="mt-2 block h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-[#14223d] outline-none focus:border-indigo-400"/></label>
            </div>
          )}

          <div className="mt-5 rounded-xl border border-slate-100 bg-[#f9fbff] p-4 text-sm text-slate-600">
            {loading ? <span className="flex items-center gap-2"><LoaderCircle size={16} className="animate-spin"/>Loading the latest boat and trip records…</span> : <><b className="text-[#14223d]">{selectedTrips.length}</b> trip{selectedTrips.length === 1 ? '' : 's'} will be included, ordered newest first. All current vessel, owner, crew, approval, and certificate details will also be included.</>}
          </div>
          {customInvalid && <p className="mt-3 text-sm text-red-600">Select a valid start and end date.</p>}
          {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
          <button type="button" disabled={loading || downloading || customInvalid || Boolean(error)} onClick={() => void download()} className="inline-flex items-center gap-2 rounded-lg bg-[#14223d] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#22375f] disabled:cursor-not-allowed disabled:opacity-45">{downloading ? <LoaderCircle size={17} className="animate-spin"/> : <Download size={17}/>} {downloading ? 'Creating PDF…' : 'Download PDF'}</button>
        </footer>
      </section>
    </div>
  );
}
