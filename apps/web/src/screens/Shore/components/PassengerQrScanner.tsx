import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import type { IScannerControls } from '@zxing/browser';
import ShoreDialog from './ShoreDialog';

type Phase = 'starting' | 'scanning' | 'stopped' | 'image' | 'verifying' | 'error';
const button = 'min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-40';
function releaseDecoder(control: IScannerControls | null) {
  // Some camera drivers expose async torch cleanup. A failed cleanup must not
  // prevent our own media tracks from being stopped or become an unhandled error.
  try { void Promise.resolve(control?.stop()).catch(() => undefined); } catch { /* Tracks are released below. */ }
}

function cameraError(reason: unknown) {
  const name = reason && typeof reason === 'object' && 'name' in reason ? String(reason.name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Camera permission was denied. Allow Camera in this site’s browser settings, then choose Start camera. You can also upload a QR image or use passenger search.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'No camera is available. Connect a camera, upload a QR image, or use passenger search.';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'The camera is busy or unavailable. Close other apps using it, then choose Start camera.';
  return 'Unable to start the camera. Try Start camera again, upload a QR image, or use passenger search.';
}

export default function PassengerQrScanner({ onScan, onClose, onSearch }: {
  onScan: (value: string) => Promise<void>; onClose: () => void; onSearch: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const consumed = useRef(false);
  const validating = useRef(false);
  const imageUrl = useRef<string | null>(null);
  const scanCallback = useRef(onScan);
  const [phase, setPhase] = useState<Phase>('starting');
  const [message, setMessage] = useState('Starting camera… Allow camera access when your browser asks.');
  const [value, setValue] = useState('');
  useLayoutEffect(() => { scanCallback.current = onScan; }, [onScan]);

  const stopCamera = useCallback(() => {
    generation.current++;
    releaseDecoder(controls.current); controls.current = null;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) { video.current.pause(); video.current.srcObject = null; }
  }, []);

  const verify = useCallback(async (rawValue: string) => {
    const clean = rawValue.trim();
    if (!clean || consumed.current || validating.current || !mounted.current) return;
    consumed.current = true; validating.current = true;
    stopCamera();
    setPhase('verifying'); setMessage('Validating passenger and selected trip…');
    try { await scanCallback.current(clean); }
    catch (reason) {
      if (mounted.current) { setPhase('error'); setMessage(reason instanceof Error ? reason.message : 'Unable to validate passenger QR.'); }
    } finally {
      validating.current = false;
      if (mounted.current) consumed.current = false;
    }
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    if (validating.current) return;
    stopCamera(); consumed.current = false;
    const attempt = generation.current;
    setPhase('starting'); setMessage('Starting camera… Allow camera access when your browser asks.');
    try {
      if (!window.isSecureContext) throw new Error('secure-context');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
      const policy = (document as Document & { permissionsPolicy?: { allowsFeature: (feature: string) => boolean }; featurePolicy?: { allowsFeature: (feature: string) => boolean } }).permissionsPolicy ??
        (document as Document & { featurePolicy?: { allowsFeature: (feature: string) => boolean } }).featurePolicy;
      if (policy && !policy.allowsFeature('camera')) throw new Error('camera-policy');
      // Retain ownership of the stream so even a late permission response is released.
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
        facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 },
      } });
      if (!mounted.current || attempt !== generation.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (!mounted.current || attempt !== generation.current || !video.current) { media.getTracks().forEach(track => track.stop()); return; }
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 200, delayBetweenScanSuccess: 500 });
      const scanner = await reader.decodeFromStream(media, video.current, (result, _error, scannerControls) => {
        if (result && mounted.current && attempt === generation.current && !consumed.current) {
          releaseDecoder(scannerControls);
          void verify(result.getText());
        }
      });
      if (!mounted.current || attempt !== generation.current) { releaseDecoder(scanner); media.getTracks().forEach(track => track.stop()); return; }
      controls.current = scanner;
      setPhase('scanning'); setMessage('Scanning… Hold the passenger QR code steady and fully inside the preview.');
    } catch (reason) {
      if (!mounted.current || attempt !== generation.current) return;
      stopCamera(); setPhase('error');
      setMessage(reason instanceof Error && reason.message === 'secure-context' ? 'Camera access requires HTTPS or localhost. Open the secure portal URL, upload a QR image, or use passenger search.' :
        reason instanceof Error && reason.message === 'unsupported' ? 'This browser does not provide camera access. Upload a QR image or use passenger search.' :
        reason instanceof Error && reason.message === 'camera-policy' ? 'Camera access is blocked by this page’s permissions policy. Open the portal directly or ask the embedding site to allow camera access. Image upload and passenger search are available.' : cameraError(reason));
    }
  }, [stopCamera, verify]);

  useEffect(() => {
    mounted.current = true;
    // Delay until after mounting; StrictMode cleanup cancels the unused first start.
    const timer = window.setTimeout(() => { void startCamera(); }, 0);
    const pause = () => {
      if (document.hidden && !validating.current) { stopCamera(); setPhase('stopped'); setMessage('Camera paused. Choose Start camera to resume.'); }
    };
    document.addEventListener('visibilitychange', pause);
    return () => {
      mounted.current = false; window.clearTimeout(timer); document.removeEventListener('visibilitychange', pause);
      stopCamera(); if (imageUrl.current) URL.revokeObjectURL(imageUrl.current);
    };
  }, [startCamera, stopCamera]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || validating.current || phase === 'image') return;
    stopCamera(); consumed.current = false;
    if (file.size > 15 * 1024 * 1024) { setPhase('error'); setMessage('Choose a QR image smaller than 15 MB.'); return; }
    const attempt = generation.current;
    setPhase('image'); setMessage('Reading QR image…');
    const url = URL.createObjectURL(file); imageUrl.current = url;
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      if (mounted.current && attempt === generation.current) await verify(result.getText());
    } catch {
      if (mounted.current && attempt === generation.current) { setPhase('error'); setMessage('No readable QR code was found. Choose a clear PNG or JPEG showing the entire QR code, or use passenger search.'); }
    } finally { URL.revokeObjectURL(url); if (imageUrl.current === url) imageUrl.current = null; }
  };
  const busy = phase === 'verifying' || phase === 'image';
  return <ShoreDialog title="Scan Passenger QR" onClose={onClose} wide>
    <p role={phase === 'error' ? 'alert' : 'status'} className={`break-words text-sm leading-6 ${phase === 'error' ? 'text-red-700' : 'text-slate-600'}`}>{message}</p>
    <video ref={video} autoPlay playsInline muted aria-label="Passenger QR camera preview" className="mt-4 aspect-[4/3] max-h-[40dvh] w-full rounded-xl bg-slate-950 object-contain" />
    <div className="mt-4 flex flex-wrap gap-2">
      {phase === 'scanning' || phase === 'starting' ? <button type="button" className={button} onClick={() => { stopCamera(); setPhase('stopped'); setMessage('Camera stopped. Choose Start camera to scan again.'); }}>Stop camera</button> :
        <button type="button" disabled={busy} className={button} onClick={() => { void startCamera(); }}>Start camera</button>}
      <label className={`${button} relative inline-flex items-center ${busy ? 'opacity-40' : 'cursor-pointer'}`}>
        Upload QR image<input type="file" accept="image/*" aria-label="Upload QR image" disabled={busy} onChange={event => { void upload(event); }} className="absolute inset-0 w-full cursor-pointer opacity-0" />
      </label>
      <button type="button" disabled={busy} className={button} onClick={onSearch}>Search passengers instead</button>
    </div>
    <form className="mt-5 space-y-2 border-t border-slate-100 pt-4" onSubmit={event => { event.preventDefault(); void verify(value); }}>
      <label htmlFor="passenger-qr-value" className="block text-xs font-medium text-slate-500">Or paste the passenger QR value</label>
      <div className="flex flex-col gap-2 sm:flex-row"><input id="passenger-qr-value" value={value} maxLength={256} onChange={event => setValue(event.target.value)} placeholder="wwms:passenger:…" disabled={busy} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-base outline-none focus:border-indigo-500" />
        <button type="submit" disabled={busy || !value.trim()} className={`${button} bg-[#14223d] text-white`}>Validate QR</button></div>
    </form>
  </ShoreDialog>;
}
