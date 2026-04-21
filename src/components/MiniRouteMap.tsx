// Lightweight static SVG mini-map for line cards (no tiles, no Leaflet).
// Plots a normalized polyline of waypoints inside a viewbox.
interface Pt { lat: number; lng: number }

interface MiniRouteMapProps {
  points: Pt[];
  className?: string;
}

export default function MiniRouteMap({ points, className }: MiniRouteMapProps) {
  if (points.length < 2) {
    return (
      <div className={`grid place-items-center text-xs text-muted-foreground ${className ?? ""}`}>
        <span className="font-mono uppercase tracking-widest opacity-60">sem rota</span>
      </div>
    );
  }

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const W = 200;
  const H = 120;
  const PAD = 14;
  const dLat = Math.max(maxLat - minLat, 0.0001);
  const dLng = Math.max(maxLng - minLng, 0.0001);

  const project = (p: Pt) => {
    const x = PAD + ((p.lng - minLng) / dLng) * (W - PAD * 2);
    // invert Y (lat increases northward)
    const y = PAD + (1 - (p.lat - minLat) / dLat) * (H - PAD * 2);
    return { x, y };
  };

  const projected = points.map(project);
  const d = projected.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const start = projected[0];
  const end = projected[projected.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="mini-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.27 0.03 254)" />
          <stop offset="100%" stopColor="oklch(0.22 0.025 252)" />
        </linearGradient>
        <linearGradient id="mini-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.72 0.17 155)" />
          <stop offset="100%" stopColor="oklch(0.68 0.19 245)" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#mini-bg)" />
      {/* subtle grid */}
      {Array.from({ length: 5 }).map((_, i) => (
        <line
          key={`h${i}`}
          x1={0}
          x2={W}
          y1={(H / 4) * i}
          y2={(H / 4) * i}
          stroke="oklch(1 0 0 / 0.04)"
          strokeWidth={1}
        />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <line
          key={`v${i}`}
          y1={0}
          y2={H}
          x1={(W / 6) * i}
          x2={(W / 6) * i}
          stroke="oklch(1 0 0 / 0.04)"
          strokeWidth={1}
        />
      ))}
      {/* path glow */}
      <path d={d} stroke="oklch(0.68 0.19 245 / 0.35)" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke="url(#mini-line)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* endpoints */}
      <circle cx={start.x} cy={start.y} r={4.5} fill="oklch(0.72 0.17 155)" stroke="oklch(0.98 0.005 250)" strokeWidth={1.5} />
      <circle cx={end.x} cy={end.y} r={4.5} fill="oklch(0.65 0.24 25)" stroke="oklch(0.98 0.005 250)" strokeWidth={1.5} />
    </svg>
  );
}
