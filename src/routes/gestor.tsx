import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Copy,
  Pencil,
  Trash2,
  Save,
  MapPin,
  X,
  Gauge,
  Settings2,
  Info,
  ChevronRight,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import {
  loadRoutes,
  saveRoutes,
  setActiveRouteId,
  getActiveRouteId,
  uid,
  maneuverLabel,
  type Route as RouteData,
  type Waypoint,
  type ManeuverType,
} from "@/lib/storage";
import { maneuverIcon } from "@/lib/maneuverIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const RouteMap = lazy(() => import("@/components/RouteMap"));

export const Route = createFileRoute("/gestor")({
  head: () => ({
    meta: [
      { title: "Gestor de Rotas — RA Routes" },
      {
        name: "description",
        content:
          "Crie, edite e organize rotas de ônibus. Adicione waypoints clicando no mapa e configure dicas de condução.",
      },
    ],
  }),
  ssr: false,
  component: GestorPage,
});

const MANEUVERS: ManeuverType[] = [
  "start", "right", "left", "straight", "highway",
  "exit", "terminal", "uturn", "merge", "end",
];

function GestorPage() {
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedWpId, setSelectedWpId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

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
  const selectedWp = useMemo(
    () => active?.waypoints.find((w) => w.id === selectedWpId) ?? null,
    [active, selectedWpId],
  );

  function persist(next: RouteData[]) {
    setRoutes(next);
    saveRoutes(next);
  }

  function updateActive(updater: (r: RouteData) => RouteData) {
    if (!active) return;
    const next = routes.map((r) =>
      r.id === active.id ? { ...updater(r), updatedAt: Date.now() } : r,
    );
    persist(next);
  }

  function handleNewRoute() {
    const r: RouteData = {
      id: uid(),
      name: `Nova rota ${routes.length + 1}`,
      waypoints: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([...routes, r]);
    setActiveId(r.id);
    setActiveRouteId(r.id);
    toast.success("Rota criada");
  }

  function handleDuplicate(id: string) {
    const src = routes.find((r) => r.id === id);
    if (!src) return;
    const copy: RouteData = {
      ...src,
      id: uid(),
      name: `${src.name} (cópia)`,
      waypoints: src.waypoints.map((w) => ({ ...w, id: uid() })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([...routes, copy]);
    toast.success("Rota duplicada");
  }

  function handleDelete(id: string) {
    if (routes.length <= 1) {
      toast.error("Não é possível excluir a única rota");
      return;
    }
    const next = routes.filter((r) => r.id !== id);
    persist(next);
    if (activeId === id) {
      setActiveId(next[0]?.id ?? null);
      setActiveRouteId(next[0]?.id ?? "");
    }
    toast.success("Rota excluída");
  }

  function commitRename(id: string) {
    if (!renameValue.trim()) {
      setRenaming(null);
      return;
    }
    const next = routes.map((r) =>
      r.id === id ? { ...r, name: renameValue.trim(), updatedAt: Date.now() } : r,
    );
    persist(next);
    setRenaming(null);
  }

  function selectRoute(id: string) {
    setActiveId(id);
    setActiveRouteId(id);
    setSelectedWpId(null);
  }

  function handleAddWaypoint(lat: number, lng: number) {
    if (!active) return;
    const newWp: Waypoint = {
      id: uid(),
      lat,
      lng,
      instruction: "Nova orientação — descreva a manobra para a voz.",
      maneuver: active.waypoints.length === 0 ? "start" : "straight",
      suggestedGear: "3ª",
      maxSpeed: 40,
      observation: "",
    };
    updateActive((r) => ({ ...r, waypoints: [...r.waypoints, newWp] }));
    setSelectedWpId(newWp.id);
    toast.success("Waypoint adicionado");
  }

  function handleMoveWaypoint(id: string, lat: number, lng: number) {
    updateActive((r) => ({
      ...r,
      waypoints: r.waypoints.map((w) =>
        w.id === id ? { ...w, lat, lng } : w,
      ),
    }));
  }

  function updateWaypoint(id: string, patch: Partial<Waypoint>) {
    updateActive((r) => ({
      ...r,
      waypoints: r.waypoints.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  }

  function removeWaypoint(id: string) {
    updateActive((r) => ({
      ...r,
      waypoints: r.waypoints.filter((w) => w.id !== id),
    }));
    if (selectedWpId === id) setSelectedWpId(null);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="grid flex-1 gap-0 lg:grid-cols-[320px_1fr_380px]">
        {/* Routes sidebar */}
        <aside className="border-r border-border bg-sidebar/60 p-4 backdrop-blur lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Rotas
            </h2>
            <Button
              size="sm"
              onClick={handleNewRoute}
              className="h-8 gap-1.5"
            >
              <Plus className="h-4 w-4" strokeWidth={2} /> Nova
            </Button>
          </div>
          <ul className="space-y-2">
            {routes.map((r) => {
              const isActive = r.id === activeId;
              return (
                <li key={r.id}>
                  <div
                    className={`group rounded-xl border p-3 transition-all ${
                      isActive
                        ? "border-primary/60 bg-primary/10 shadow-[var(--shadow-glow)]"
                        : "border-border bg-surface hover:border-border/80"
                    }`}
                  >
                    <button
                      onClick={() => selectRoute(r.id)}
                      className="flex w-full items-start justify-between gap-2 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        {renaming === r.id ? (
                          <Input
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onBlur={() => commitRename(r.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(r.id);
                              if (e.key === "Escape") setRenaming(null);
                            }}
                            className="h-7 text-sm"
                          />
                        ) : (
                          <p className="truncate text-sm font-medium">{r.name}</p>
                        )}
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          {r.waypoints.length} pontos
                        </p>
                      </div>
                      {isActive && (
                        <ChevronRight
                          className="h-4 w-4 shrink-0 text-primary"
                          strokeWidth={2}
                        />
                      )}
                    </button>
                    <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => {
                          setRenaming(r.id);
                          setRenameValue(r.name);
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="Renomear"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => handleDuplicate(r.id)}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        title="Duplicar"
                      >
                        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 rounded-xl border border-border bg-surface p-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
              <p>
                <span className="font-medium text-foreground">Dica:</span>{" "}
                clique no mapa para adicionar um waypoint. Arraste os marcadores
                para reposicioná-los.
              </p>
            </div>
          </div>
        </aside>

        {/* Map */}
        <section className="relative h-[60vh] lg:h-[calc(100vh-4rem)]">
          {active ? (
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-muted-foreground">
                  Carregando mapa…
                </div>
              }
            >
              <RouteMap
                key={active.id}
                waypoints={active.waypoints}
                editable
                onAddWaypoint={handleAddWaypoint}
                onMoveWaypoint={handleMoveWaypoint}
                selectedWaypointId={selectedWpId}
                onSelectWaypoint={setSelectedWpId}
              />
            </Suspense>
          ) : (
            <div className="grid h-full place-items-center text-muted-foreground">
              Selecione ou crie uma rota
            </div>
          )}
        </section>

        {/* Waypoint editor */}
        <aside className="border-l border-border bg-sidebar/60 backdrop-blur lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto">
          <AnimatePresence mode="wait">
            {selectedWp && active ? (
              <motion.div
                key={selectedWp.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5 p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-primary" strokeWidth={1.75} />
                    <h3 className="text-sm font-semibold uppercase tracking-wider">
                      Editar waypoint
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedWpId(null)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>

                <WaypointForm
                  key={selectedWp.id}
                  wp={selectedWp}
                  onChange={(patch) => updateWaypoint(selectedWp.id, patch)}
                  onRemove={() => removeWaypoint(selectedWp.id)}
                />
              </motion.div>
            ) : active ? (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Waypoints
                  </h3>
                  <span className="font-mono text-xs text-muted-foreground">
                    {active.waypoints.length}
                  </span>
                </div>
                {active.waypoints.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center">
                    <MapPin
                      className="mx-auto h-8 w-8 text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <p className="mt-3 text-sm text-muted-foreground">
                      Clique no mapa para adicionar o primeiro ponto.
                    </p>
                  </div>
                ) : (
                  <ol className="space-y-2">
                    {active.waypoints.map((w, i) => {
                      const Icon = maneuverIcon[w.maneuver];
                      return (
                        <li key={w.id}>
                          <button
                            onClick={() => setSelectedWpId(w.id)}
                            className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-all hover:border-primary/50 hover:bg-surface-2"
                          >
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
                              <Icon className="h-4 w-4" strokeWidth={1.75} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                  #{i + 1} · {maneuverLabel(w.maneuver)}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-foreground/90">
                                {w.instruction}
                              </p>
                              <div className="mt-1.5 flex gap-3 font-mono text-[10px] text-muted-foreground">
                                <span>{w.suggestedGear}</span>
                                <span>{w.maxSpeed} km/h</span>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

function WaypointForm({
  wp,
  onChange,
  onRemove,
}: {
  wp: Waypoint;
  onChange: (patch: Partial<Waypoint>) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(wp);
  useEffect(() => setDraft(wp), [wp]);

  const Icon = maneuverIcon[draft.maneuver];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <div>lat {draft.lat.toFixed(5)}</div>
          <div>lng {draft.lng.toFixed(5)}</div>
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Orientação (texto e voz)
        </Label>
        <Textarea
          rows={3}
          value={draft.instruction}
          onChange={(e) => setDraft({ ...draft, instruction: e.target.value })}
          placeholder="Ex.: Vire à direita na Av. Wilson Tavares"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Tipo de manobra
        </Label>
        <Select
          value={draft.maneuver}
          onValueChange={(v) =>
            setDraft({ ...draft, maneuver: v as ManeuverType })
          }
        >
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MANEUVERS.map((m) => {
              const I = maneuverIcon[m];
              return (
                <SelectItem key={m} value={m}>
                  <span className="flex items-center gap-2">
                    <I className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {maneuverLabel(m)}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Marcha
          </Label>
          <Input
            value={draft.suggestedGear}
            onChange={(e) =>
              setDraft({ ...draft, suggestedGear: e.target.value })
            }
            className="mt-1.5 font-mono"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Vel. máx (km/h)
          </Label>
          <Input
            type="number"
            value={draft.maxSpeed}
            onChange={(e) =>
              setDraft({ ...draft, maxSpeed: Number(e.target.value) || 0 })
            }
            className="mt-1.5 font-mono"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
          Observação
        </Label>
        <Textarea
          rows={2}
          value={draft.observation}
          onChange={(e) => setDraft({ ...draft, observation: e.target.value })}
          placeholder="Curva acentuada, escola próxima…"
          className="mt-1.5"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          className="flex-1 gap-2"
          onClick={() => {
            onChange(draft);
            toast.success("Waypoint atualizado");
          }}
        >
          <Save className="h-4 w-4" strokeWidth={2} /> Salvar
        </Button>
        <Button
          variant="outline"
          onClick={onRemove}
          className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2} /> Remover
        </Button>
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-xs text-muted-foreground">
        <Gauge className="h-4 w-4 text-accent" strokeWidth={1.75} />
        Esta orientação será falada no modo Motorista.
      </div>
    </div>
  );
}
