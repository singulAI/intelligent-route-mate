import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Bus, MapPin, Sparkles, Clock, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { LineRow, WaypointRow } from "@/lib/api";
import MiniRouteMap from "@/components/MiniRouteMap";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RA Routes — Portal das Linhas Urbanas" },
      { name: "description", content: "Conheça as 36 linhas de transporte público urbano: mapas, horários, orientações e notificações em tempo real." },
      { property: "og:title", content: "RA Routes — Portal das Linhas Urbanas" },
      { property: "og:description", content: "Mapas, horários e orientações das linhas de ônibus urbano." },
    ],
  }),
  ssr: false,
  component: PublicHome,
});

interface LineWithWaypoints extends LineRow {
  waypoints: { lat: number; lng: number }[];
}

async function fetchLinesWithRoutes(): Promise<LineWithWaypoints[]> {
  // Get all lines (public RLS returns only published)
  const { data: lines, error } = await supabase
    .from("lines")
    .select("*, waypoints(lat,lng,position)")
    .order("number", { ascending: true });
  if (error) throw error;

  type Row = LineRow & { waypoints: { lat: number; lng: number; position: number }[] };
  return (lines as Row[] | null ?? []).map((l) => ({
    ...l,
    waypoints: [...(l.waypoints ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((w) => ({ lat: w.lat, lng: w.lng })),
  }));
}

function PublicHome() {
  const { data: publishedLines = [], isLoading } = useQuery({
    queryKey: ["public-lines"],
    queryFn: fetchLinesWithRoutes,
  });

  // Build a 36-card grid: fill with published, then placeholders to reach 36
  const slots = useMemo(() => {
    const arr: (LineWithWaypoints | null)[] = [...publishedLines];
    while (arr.length < 36) arr.push(null);
    return arr.slice(0, 36);
  }, [publishedLines]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ambient blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-7xl px-6 py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-14 text-center"
        >
          <div className="mx-auto mb-6 inline-flex items-center gap-3 rounded-full border border-border bg-surface/60 px-4 py-1.5 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Portal Público · {publishedLines.length} de 36 linhas ativas
            </span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Linhas urbanas{" "}
            <span className="bg-gradient-to-br from-primary via-primary to-accent bg-clip-text text-transparent">
              em tempo real
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            Explore mapas interativos, horários, orientações de condução e notificações de cada linha.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            {[
              { Icon: MapPin, label: "Mapa interativo" },
              { Icon: Clock, label: "Quadro de horários" },
              { Icon: Bell, label: "Notificações" },
              { Icon: Sparkles, label: "Orientações em voz" },
            ].map(({ Icon, label }) => (
              <div key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span className="font-mono uppercase tracking-[0.18em]">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Grid of 36 cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {slots.map((line, idx) => (
            <motion.div
              key={line?.id ?? `slot-${idx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.015, 0.4) }}
            >
              {line ? (
                <LineCard line={line} />
              ) : (
                <PlaceholderCard index={idx + 1} />
              )}
            </motion.div>
          ))}
        </div>

        {isLoading && (
          <p className="mt-8 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Carregando…
          </p>
        )}

        <footer className="mt-20 flex items-center justify-center gap-2 border-t border-border pt-6 text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground/60">
          <Bus className="h-3 w-3" />
          <span>RA Routes · Portal Público</span>
        </footer>
      </main>
    </div>
  );
}

function LineCard({ line }: { line: LineWithWaypoints }) {
  return (
    <Link
      to="/linha/$numero"
      params={{ numero: String(line.number) }}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:border-primary/50 hover:shadow-[var(--shadow-elevated)]"
    >
      <div className="relative h-28 overflow-hidden">
        <MiniRouteMap points={line.waypoints} className="h-full w-full" />
        <div className="absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 font-mono text-[11px] font-bold text-primary backdrop-blur">
          {String(line.number).padStart(3, "0")}
        </div>
        {line.cover_image_url && (
          <img
            src={line.cover_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-luminosity transition-opacity group-hover:opacity-50"
          />
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">
          {line.name}
        </h3>
        <div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>{line.waypoints.length} pontos</span>
          {line.fare && <span>R$ {Number(line.fare).toFixed(2)}</span>}
        </div>
      </div>
    </Link>
  );
}

function PlaceholderCard({ index }: { index: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-border/60 bg-surface/30 p-3">
      <div className="grid h-28 place-items-center rounded-lg bg-gradient-to-br from-surface to-surface-2/40">
        <div className="text-center">
          <div className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-muted/50">
            <Bus className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
          </div>
          <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
            Slot {String(index).padStart(2, "0")}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Em breve</h3>
        <p className="mt-1 text-[10px] text-muted-foreground/70">
          Nova rota será carregada em breve.
        </p>
      </div>
    </div>
  );
}
