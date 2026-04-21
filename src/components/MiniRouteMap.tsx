// Lightweight static SVG mini-map for line cards (no tiles, no Leaflet).
// Light theme — clean lines, Figma-style.
interface Pt { lat: number; lng: number }

interface MiniRouteMapProps {
  points: Pt[];
  className?: string;
}

export default function MiniRouteMap({ points, className }: MiniRouteMapProps) {
  if (points.length < 2) {
    return (
      <div className={`grid place-items-center text-xs text-muted-foreground/60 ${className ?? ""}`}>
        <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 22 C 10 8, 22 24, 27 10" />
          <circle cx="5" cy="22" r="1.5" fill="currentColor" />
          <circle cx="27" cy="10" r="1.5" fill="currentColor" />
        </svg>
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
  const PAD = 16;
  const dLat = Math.max(maxLat - minLat, 0.0001);
  const dLng = Math.max(maxLng - minLng, 0.0001);

  const project = (p: Pt) => {
    const x = PAD + ((p.lng - minLng) / dLng) * (W - PAD * 2);
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
        <linearGradient id="mini-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.985 0.003 250)" />
          <stop offset="100%" stopColor="oklch(0.96 0.008 250)" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#mini-bg)" />
      {/* subtle dotted grid */}
      {Array.from({ length: 6 }).map((_, i) =>
        Array.from({ length: 10 }).map((__, j) => (
          <circle
            key={`g-${i}-${j}`}
            cx={(W / 9) * j + (W / 18)}
            cy={(H / 5) * i + (H / 10)}
            r={0.6}
            fill="oklch(0.18 0.015 255 / 0.08)"
          />
        )),
      )}
      {/* path — single continuous line, Figma style */}
      <path
        d={d}
        stroke="oklch(0.55 0.16 255)"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* endpoints — minimal rings */}
      <circle cx={start.x} cy={start.y} r={3.5} fill="oklch(1 0 0)" stroke="oklch(0.55 0.16 255)" strokeWidth={1.5} />
      <circle cx={end.x} cy={end.y} r={3.5} fill="oklch(0.55 0.16 255)" stroke="oklch(1 0 0)" strokeWidth={1.5} />
    </svg>
  );
}
