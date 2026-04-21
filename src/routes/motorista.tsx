import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Square, Volume2, VolumeX, Gauge, AlertTriangle, Navigation,
  CheckCircle2, Satellite, ArrowLeft, Bus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAllLines, fetchWaypoints, maneuverLabel,
  type LineRow, type WaypointRow,
} from "@/lib/api";
import { maneuverIcon } from "@/lib/maneuverIcons";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSpeech } from "@/hooks/useSpeech";

const RouteMap = lazy(() => import("@/components/RouteMap"));

export const Route = createFileRoute("/motorista")({
  ssr: false,
  head: () => ({ meta: [{ title: "Modo Motorista — RA Routes" }] }),
  component: MotoristaPage,
});

const STEP_MS = 5000;

function MotoristaPage() {
  const linesQ = useQuery({ queryKey: ["public-lines-list"], queryFn: fetchAllLines });
  const lines = linesQ.data ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);

  // Auto-pick first published line on load
  useEffect(() => {
    if (!activeId && lines.length > 0) setActiveId(lines[0].id);
  }, [lines, activeId]);

  const active = lines.find((l) => l.id === activeId) ?? null;

  const wpQ = useQuery({
    queryKey: ["motorista-wp", activeId],
    queryFn: () => fetchWaypoints(activeId!),
    enabled: !!activeId,
  });

  const waypoints = useMemo(() => wpQ.data ?? [], [wpQ.data]);

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Portal
          </Link>
          <div className="ml-2 rounded-md bg-accent/15 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-accent">
            Motorista
          </div>
          <Select value={activeId ?? ""} onValueChange={setActiveId}>
            <SelectTrigger className="ml-auto w-[280px]">
              <SelectValue placeholder="Selecione uma linha" />
            </SelectTrigger>
            <SelectContent>
              {lines.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {String(l.number).padStart(3, "0")} — {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {!active ? (
          <div className="grid place-items-center py-20 text-center">
            <Bus className="h-12 w-12 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Selecione uma linha para iniciar a condução.</p>
          </div>
        ) : (
          <Cockpit line={active} waypoints={waypoints} />
        )}
      </main>
    </div>
  );
}

function Cockpit({ line, waypoints }: { line: LineRow; waypoints: WaypointRow[] }) {
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const { speak, stop } = useSpeech();
  const timerRef = useRef<number | null>(null);

  const current = waypoints[stepIdx] ?? null;
  const next = waypoints[stepIdx + 1] ?? null;
  const finished = stepIdx >= waypoints.length - 1;

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); stop(); }, [stop]);

  useEffect(() => {
    setStepIdx(0); setRunning(false); setCurrentSpeed(0);
  }, [line.id]);

  const tick = () => {
    setStepIdx((i) => {
      const ni = i + 1;
      if (ni >= waypoints.length) { setRunning(false); return i; }
      const w = waypoints[ni];
      setCurrentSpeed(w.max_speed ?? 0);
      if (!muted) speak(w.instruction, { priority: true });
      return ni;
    });
  };

  const start = () => {
    if (waypoints.length === 0) return;
    setRunning(true);
    if (!muted && current) speak(current.instruction, { priority: true });
    setCurrentSpeed(current?.max_speed ?? 0);
    timerRef.current = window.setInterval(tick, STEP_MS);
  };

  const stopRun = () => {
    setRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    stop();
  };

  const reset = () => { stopRun(); setStepIdx(0); setCurrentSpeed(0); };

  const speedPct = current?.max_speed ? Math.min(100, (currentSpeed / current.max_speed) * 100) : 0;
  const Icon = current ? maneuverIcon[current.maneuver_type] : Navigation;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
      <div className="h-[70vh] overflow-hidden rounded-2xl border border-border">
        <Suspense fallback={<div className="grid h-full place-items-center text-xs text-muted-foreground">Carregando mapa…</div>}>
          <RouteMap
            waypoints={waypoints.map((w) => ({
              id: w.id, lat: w.lat, lng: w.lng, instruction: w.instruction,
              maneuver: w.maneuver_type, suggestedGear: w.suggested_gear ?? "",
              maxSpeed: w.max_speed ?? 0, observation: w.observation ?? "",
            }))}
            busPosition={current ? { lat: current.lat, lng: current.lng } : null}
            selectedWaypointId={current?.id ?? null}
          />
        </Suspense>
      </div>

      <div className="space-y-3">
        {/* Control */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex gap-2">
            {!running ? (
              <Button onClick={start} disabled={waypoints.length === 0 || finished} className="flex-1">
                <Play className="mr-1.5 h-4 w-4" /> Iniciar
              </Button>
            ) : (
              <Button onClick={stopRun} variant="destructive" className="flex-1">
                <Square className="mr-1.5 h-4 w-4" /> Parar
              </Button>
            )}
            <Button onClick={reset} variant="outline">Reset</Button>
            <Button onClick={() => setMuted((m) => !m)} variant="outline" size="icon">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {String(line.number).padStart(3, "0")} · {line.name}
          </p>
        </div>

        {/* Current step */}
        <AnimatePresence mode="wait">
          {current && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              className="rounded-2xl border border-primary/40 bg-primary/10 p-4"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Etapa {stepIdx + 1} de {waypoints.length} · {maneuverLabel(current.maneuver_type)}
                  </p>
                  <p className="text-sm font-semibold leading-tight">{current.instruction}</p>
                </div>
              </div>
              {current.observation && (
                <p className="mt-3 flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />{current.observation}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Telemetry */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Telemetria</p>
          <div className="mt-3 flex items-baseline gap-2">
            <Gauge className="h-5 w-5 text-accent" />
            <span className="font-mono text-3xl font-bold">{currentSpeed}</span>
            <span className="text-xs text-muted-foreground">km/h · máx {current?.max_speed ?? "—"}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-to-r from-success via-warning to-destructive transition-all" style={{ width: `${speedPct}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Marcha</p>
              <p className="font-semibold">{current?.suggested_gear ?? "—"}</p>
            </div>
            <div className="rounded-lg bg-surface-2 p-2">
              <p className="font-mono text-[10px] uppercase text-muted-foreground">Próximo</p>
              <p className="truncate font-semibold">{next ? maneuverLabel(next.maneuver_type) : "Fim"}</p>
            </div>
          </div>
        </div>

        {finished && (
          <div className="flex items-center gap-2 rounded-xl border border-success/40 bg-success/10 p-3 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Trajeto concluído.
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <Satellite className="h-3 w-3" /> GPS simulado
        </div>
      </div>
    </div>
  );
}
