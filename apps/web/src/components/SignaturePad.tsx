import { useRef, useState, type PointerEvent } from 'react';

export default function SignaturePad({
  label,
  onChange,
  disabled = false,
}: {
  label: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasInk, setHasInk] = useState(false);

  const position = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * canvas.height / bounds.height,
    };
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const canvas = canvasRef.current!;
    const point = position(event);
    const context = canvas.getContext('2d')!;
    context.beginPath();
    context.moveTo(point.x, point.y);
    setDrawing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || disabled) return;
    const canvas = canvasRef.current!;
    const point = position(event);
    const context = canvas.getContext('2d')!;
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.strokeStyle = '#14223d';
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasInk(true);
    onChange(canvas.toDataURL('image/png'));
  };

  const finish = () => setDrawing(false);
  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas || disabled) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange('');
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <button type="button" disabled={disabled || !hasInk} onClick={clear} className="text-xs font-semibold text-indigo-700 disabled:opacity-40">
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width="700"
        height="180"
        aria-label={label}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className={`h-32 w-full touch-none rounded-lg border bg-white ${hasInk ? 'border-emerald-400' : 'border-slate-300'} ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-crosshair'}`}
      />
    </div>
  );
}
