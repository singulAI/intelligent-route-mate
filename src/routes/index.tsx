import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import type { LineRow } from "@/lib/api";
import MiniRouteMap from "@/components/MiniRouteMap";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Condução Inteligente" },
      {
        name: "description",
        content:
          "Portal das linhas urbanas — mapas, rotas e orientações para uma condução mais inteligente.",
      },
      { property: "og:title", content: "Condução Inteligente" },
      {
        property: "og:description",
        content: "Portal das linhas urbanas — condução mais inteligente.",
      },
    ],
  }),
  ssr: false,
  component: PublicHome,
});

interface LineWithWaypoints extends LineRow {
  waypoints: { lat: number; lng: number }[];
}

async function fetchLinesWithRoutes(): Promise<LineWithWaypoints[]> {
  const { data: lines, error } = await supabase
    .from("lines")
    .select("*, waypoints(lat,lng,position)")
    .order("number", { ascending: true });
  if (error) throw error;

  type Row = LineRow & {
    waypoints: { lat: number; lng: number; position: number }[];
  };
  return (lines as Row[] | null ?? []).map((l) => ({
    ...l,
    waypoints: [...(l.waypoints ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((w) => ({ lat: w.lat, lng: w.lng })),
  }));
}

function PublicHome() {
  const { data: publishedLines = [] } = useQuery({
    queryKey: ["public-lines"],
    queryFn: fetchLinesWithRoutes,
  });

  // Fill grid up to 36 — real lines first (in insertion order), then placeholders
  const slots = useMemo(() => {
    const arr: (LineWithWaypoints | null)[] = [...publishedLines];
    while (arr.length < 36) arr.push(null);
    return arr.slice(0, 36);
  }, [publishedLines]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Soft ambient light — no harsh gradients */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[760px] -translate-x-1/2 rounded-full bg-[oklch(0.55_0.16_255_/_0.06)] blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-[1280px] px-5 pb-24 pt-16 sm:px-8 md:pt-24">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 text-center md:mb-20"
        >
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Condução Inteligente
          </h1>
        </motion.div>

        {/* Grid: 1 / 2 / 3 / 4 cards per row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
          {slots.map((line, idx) => (
            <motion.div
              key={line?.id ?? `slot-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: Math.min(idx * 0.025, 0.6),
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {line ? <LineCard line={line} /> : <PlaceholderCard />}
            </motion.div>
          ))}
        </div>

        <Footer />
      </main>
    </div>
  );
}

function LineCard({ line }: { line: LineWithWaypoints }) {
  return (
    <Link
      to="/linha/$numero"
      params={{ numero: String(line.number) }}
      className="group block overflow-hidden rounded-2xl border border-border bg-surface shadow-soft transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card"
    >
      <div className="relative aspect-[5/3] overflow-hidden bg-secondary/40">
        {line.cover_image_url ? (
          <img
            src={line.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <MiniRouteMap points={line.waypoints} className="h-full w-full" />
        )}
      </div>
      <div className="flex items-baseline gap-2 px-4 py-3.5">
        <span className="font-mono text-[11px] font-semibold tracking-wider text-primary">
          {String(line.number).padStart(3, "0")}
        </span>
        <h3 className="line-clamp-1 text-[13px] font-medium leading-tight text-foreground">
          {line.name}
        </h3>
      </div>
    </Link>
  );
}

function PlaceholderCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-dashed border-border/80 bg-surface/40">
      <div className="grid aspect-[5/3] place-items-center">
        <svg
          viewBox="0 0 32 32"
          className="h-8 w-8 text-muted-foreground/30"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 22 C 10 8, 22 24, 27 10" />
          <circle cx="5" cy="22" r="1.5" fill="currentColor" />
          <circle cx="27" cy="10" r="1.5" fill="currentColor" />
        </svg>
      </div>
      <div className="px-4 py-3.5">
        <p className="text-[13px] font-medium text-muted-foreground/80">Em breve</p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-20 flex flex-col items-center gap-1.5 text-[10px] text-muted-foreground/60 sm:flex-row sm:justify-center sm:gap-3">
      <a
        href="https://rodrigo.run"
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono uppercase tracking-[0.2em] transition-colors hover:text-foreground"
      >
        DEV — rodrigo.run
      </a>
      <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
      <span className="font-mono uppercase tracking-[0.2em]">
        © 2026 Guilherme H. Oliveira
      </span>
    </footer>
  );
}
