import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Square,
  Volume2,
  VolumeX,
  Gauge,
  AlertTriangle,
  Navigation,
  CheckCircle2,
  Satellite,
  Route as RouteIcon,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import {
  loadRoutes,
  getActiveRouteId,
  setActiveRouteId,
  maneuverLabel,
  type Route as RouteData,
  type Waypoint,
} from "@/lib/storage";
import { maneuverIcon } from "@/lib/maneuverIcons";
import { Button } from "@/components/ui/button";
import { useSpeech } from "@/hooks/useSpeech";

const RouteMap = lazy(() => import("@/components/RouteMap"));

export const Route = createFileRoute("/motorista")({
  head: () => ({
    meta: [
      { title: "Modo Motorista — RA Routes" },
      {
        name: "description",
        content:
          "Conduza a Linha 474 com orientações de voz em tempo real, telemetria simulada e alertas de velocidade.",
      },
    ],
  }),
  ssr: false,
  component: MotoristaPage,
});

const STEP_MS = 5000;

function MotoristaPage() {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [busPos, setBusPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [speed, setSpeed] = useState(0); // km/h simulado
  const [overspeedAlert, setOverspeedAlert] = useState(false);

  const { speak, stop } = useSpeech();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overspeedSpokenRef = useRef(false);

  useEffect(() => {
    const r = loadRoutes();
    setRoutes(r);
    const a = getActiveRouteId() ?? r[0]?.id ?? null;
    setActiveId(a);
  }, []);

  const active = useMemo(
    () => routes.find((r) => r.id === activeId) ?? null,
    [routes, activeId],
  );
  const wps: Waypoint[] = active?.waypoints ?? [];
  const currentWp = wps[stepIndex] ?? null;
  const targetSpeed = currentWp?.maxSpeed ?? 0;

  // Telemetria derivada
  const rpm = Math.round(800 + (speed / Math.max(1, targetSpeed)) * 2200);
  const gear = currentWp?.suggestedGear ?? "N";

  function speakWp(wp: Waypoint) {
    if (muted) return;
    const tip = `Marcha sugerida ${wp.suggestedGear}. Velocidade máxima ${wp.maxSpeed} quilômetros por hora. ${wp.observation}`;
    speak(`${wp.instruction}. ${tip}`, { priority: true });
  }

  function startSimulation() {
    if (!active || wps.length === 0) return;
    setRunning(true);
    setStepIndex(0);
    setBusPos({ lat: wps[0].lat, lng: wps[0].lng });
    setSpeed(0);
    overspeedSpokenRef.current = false;
    speakWp(wps[0]);

    let i = 0;
    intervalRef.current = setInterval(() => {
      i++;
      if (i >= wps.length) {
        stopSimulation(true);
        return;
      }
      setStepIndex(i);
      setBusPos({ lat: wps[i].lat, lng: wps[i].lng });
      overspeedSpokenRef.current = false;
      speakWp(wps[i]);
    }, STEP_MS);
  }

  function stopSimulation(completed = false) {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (speedTickRef.current) clearInterval(speedTickRef.current);
    intervalRef.current = null;
    speedTickRef.current = null;
    setSpeed(0);
    setBusPos(null);
    setOverspeedAlert(false);
    stop();
    if (completed && !muted) {
      speak("Percurso concluído. Bom trabalho.", { priority: true });
    }
  }

  // Loop de aproximação de velocidade ao alvo, com pequena variação
  useEffect(() => {
    if (!running) return;
    speedTickRef.current = setInterval(() => {
      setSpeed((s) => {
        const noise = (Math.random() - 0.45) * 6;
        const target = targetSpeed + noise;
        const next = s + (target - s) * 0.25;
        return Math.max(0, Math.round(next));
      });
    }, 400);
    return () => {
      if (speedTickRef.current) clearInterval(speedTickRef.current);
    };
  }, [running, targetSpeed]);

  // Alerta de excesso
  useEffect(() => {
    if (!running || !currentWp) return;
    const over = speed > currentWp.maxSpeed + 3;
    setOverspeedAlert(over);
    if (over && !overspeedSpokenRef.current && !muted) {
      overspeedSpokenRef.current = true;
      speak("Velocidade acima do permitido, reduza", { priority: true });
    }
    if (!over) overspeedSpokenRef.current = false;
  }, [speed, running, currentWp, muted, speak]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (speedTickRef.current) clearInterval(speedTickRef.current);
      stop();
    };
  }, [stop]);

  if (!active) {
    return (
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <div className="grid flex-1 place-items-center text-muted-foreground">
          <div className="text-center">
            <p>Nenhuma rota disponível.</p>
            <Link to="/gestor" className="mt-4 inline-block text-primary underline">
              Ir ao Gestor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_420px]">
        {/* Map */}
        <section className="relative h-[55vh] lg:h-[calc(100vh-4rem)]">
          <Suspense
            fallback={
              <div className="grid h-full place-items-center text-muted-foreground">
                Carregando mapa…
              </div>
            }
          >
            <RouteMap waypoints={wps} busPosition={busPos} />
          </Suspense>

          {/* Route picker overlay */}
          <div className="pointer-events-auto absolute left-4 top-4 z-[400] flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 backdrop-blur">
            <RouteIcon className="h-4 w-4 text-primary" strokeWidth={1.75} />
            <select
              value={active.id}
              onChange={(e) => {
                setActiveId(e.target.value);
                setActiveRouteId(e.target.value);
                stopSimulation();
              }}
              className="bg-transparent text-sm font-medium outline-none"
            >
              {routes.map((r) => (
                <option key={r.id} value={r.id} className="bg-surface text-foreground">
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Overspeed flash */}
          <AnimatePresence>
            {overspeedAlert && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 z-[300] ring-4 ring-inset ring-destructive/60"
              />
            )}
          </AnimatePresence>
        </section>

        {/* Cockpit panel */}
        <aside className="border-l border-border bg-sidebar/60 backdrop-blur lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
          <div className="space-y-5 p-5">
            {/* Telemetria */}
            <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-2 p-5 shadow-[var(--shadow-elevated)]">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Telemetria
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${running ? "bg-success animate-pulse" : "bg-muted-foreground/40"}`}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {running ? "ativo" : "ocioso"}
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <div
                    className={`font-mono text-6xl font-bold leading-none tabular-nums transition-colors ${overspeedAlert ? "text-destructive" : "text-foreground"}`}
                  >
                    {speed}
                  </div>
                  <div className="mt-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    km/h
                  </div>
                </div>
                <div className="space-y-2 text-right">
                  <Stat label="Marcha" value={gear} />
                  <Stat label="RPM" value={running ? rpm.toString() : "—"} />
                  <Stat
                    label="Limite"
                    value={`${targetSpeed} km/h`}
                  />
                </div>
              </div>

              {/* Speed bar */}
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className={`h-full ${overspeedAlert ? "bg-destructive" : "bg-primary"}`}
                  animate={{
                    width: `${Math.min(100, (speed / Math.max(targetSpeed * 1.3, 1)) * 100)}%`,
                  }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Alerta ativo */}
            <AnimatePresence>
              {overspeedAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-start gap-3 rounded-xl border border-destructive/60 bg-destructive/15 p-4"
                >
                  <AlertTriangle
                    className="h-5 w-5 shrink-0 text-destructive"
                    strokeWidth={2}
                  />
                  <div>
                    <p className="text-sm font-semibold text-destructive">
                      Velocidade acima do permitido
                    </p>
                    <p className="mt-0.5 text-xs text-destructive/80">
                      Reduza para no máximo {targetSpeed} km/h.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Etapa atual */}
            {currentWp && (
              <CurrentStep wp={currentWp} index={stepIndex} total={wps.length} />
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {!running ? (
                <Button onClick={startSimulation} className="flex-1 gap-2" size="lg">
                  <Play className="h-4 w-4" strokeWidth={2} /> Simular
                </Button>
              ) : (
                <Button
                  onClick={() => stopSimulation()}
                  variant="outline"
                  className="flex-1 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  size="lg"
                >
                  <Square className="h-4 w-4" strokeWidth={2} /> Parar
                </Button>
              )}
              <Button
                onClick={() => setMuted((m) => !m)}
                variant="outline"
                size="lg"
                className="gap-2"
                title={muted ? "Ativar voz" : "Silenciar voz"}
              >
                {muted ? (
                  <VolumeX className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <Volume2 className="h-4 w-4" strokeWidth={2} />
                )}
              </Button>
            </div>

            {/* Step list */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Etapas do percurso
                </h3>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {stepIndex + 1}/{wps.length}
                </span>
              </div>
              <ol className="space-y-1.5">
                {wps.map((w, i) => {
                  const Icon = maneuverIcon[w.maneuver];
                  const passed = i < stepIndex && running;
                  const isCurrent = i === stepIndex && running;
                  return (
                    <li key={w.id}>
                      <div
                        className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                          isCurrent
                            ? "border-accent/60 bg-accent/10"
                            : passed
                              ? "border-border bg-surface/50 opacity-60"
                              : "border-border bg-surface"
                        }`}
                      >
                        <div
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${
                            isCurrent
                              ? "bg-accent text-accent-foreground"
                              : passed
                                ? "bg-success/20 text-success"
                                : "bg-primary/15 text-primary"
                          }`}
                        >
                          {passed ? (
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                          ) : (
                            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                            #{i + 1} · {maneuverLabel(w.maneuver)} · {w.suggestedGear} ·{" "}
                            {w.maxSpeed} km/h
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-foreground/90">
                            {w.instruction}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-border bg-surface p-3 text-[11px] text-muted-foreground">
              <Satellite className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />
              <p>
                <span className="font-medium text-foreground">Próxima evolução:</span>{" "}
                substituir simulação pela posição real do GPS do dispositivo
                (<code className="font-mono">watchPosition</code>).
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function CurrentStep({
  wp,
  index,
  total,
}: {
  wp: Waypoint;
  index: number;
  total: number;
}) {
  const Icon = maneuverIcon[wp.maneuver];
  return (
    <motion.div
      key={wp.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/40 bg-primary/10 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Navigation className="h-3 w-3 text-primary" strokeWidth={2} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
              etapa {index + 1} de {total} · {maneuverLabel(wp.maneuver)}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-medium leading-snug">
            {wp.instruction}
          </p>
          {wp.observation && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
              <Gauge className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span>{wp.observation}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
