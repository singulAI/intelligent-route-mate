import { lazy, Suspense, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Clock, Volume2, Image as ImageIcon,
  Calendar, Tag, Building2, AlertTriangle, Info, AlertCircle,
  FileDown, Video, Share2, Navigation, Send, MessageSquare,
} from "lucide-react";
import {
  fetchLineByNumber, fetchWaypoints, fetchMedia, fetchNotifications,
  fetchSchedules, maneuverLabel, submitObservation, isVisible,
  type WaypointRow, type LineRow,
} from "@/lib/api";
import { maneuverIcon } from "@/lib/maneuverIcons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSpeech } from "@/hooks/useSpeech";
import { toast } from "sonner";

const RouteMap = lazy(() => import("@/components/RouteMap"));

export const Route = createFileRoute("/linha/$numero")({
  ssr: false,
  loader: async ({ params }) => {
    const num = Number(params.numero);
    if (!Number.isFinite(num)) throw notFound();
    return { num };
  },
  head: ({ params }) => ({
    meta: [
      { title: `Linha ${params.numero} — RA Routes` },
      { name: "description", content: `Detalhes da linha ${params.numero}: mapa, horários, orientações e avisos.` },
    ],
  }),
  component: LineDetailPage,
  notFoundComponent: () => <NotFound />,
});

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Linha não encontrada</h1>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">Voltar ao portal</Link>
      </div>
    </div>
  );
}

function LineDetailPage() {
  const { num } = Route.useLoaderData();

  const lineQ = useQuery({
    queryKey: ["line", num],
    queryFn: () => fetchLineByNumber(num),
  });

  const line = lineQ.data;

  const wpQ = useQuery({
    queryKey: ["waypoints", line?.id],
    queryFn: () => fetchWaypoints(line!.id),
    enabled: !!line,
  });
  const mediaQ = useQuery({
    queryKey: ["media", line?.id],
    queryFn: () => fetchMedia(line!.id),
    enabled: !!line,
  });
  const notifQ = useQuery({
    queryKey: ["notif", line?.id],
    queryFn: () => fetchNotifications(line!.id),
    enabled: !!line,
  });
  const schedQ = useQuery({
    queryKey: ["sched", line?.id],
    queryFn: () => fetchSchedules(line!.id),
    enabled: !!line,
  });

  if (lineQ.isLoading) {
    return <div className="grid min-h-screen place-items-center font-mono text-xs uppercase tracking-widest text-muted-foreground">Carregando…</div>;
  }
  if (!line) return <NotFound />;

  const waypoints = wpQ.data ?? [];
  const media = mediaQ.data ?? [];
  const notifs = notifQ.data ?? [];
  const schedules = schedQ.data ?? [];
  const images = media.filter((m) => m.type === "image");
  const videos = media.filter((m) => m.type === "video");

  // Visibility flags
  const showName = isVisible(line, "show_name");
  const showNumber = isVisible(line, "show_number");
  const showFare = isVisible(line, "show_fare");
  const showConsortium = isVisible(line, "show_consortium");
  const showDelegatary = isVisible(line, "show_delegatary");
  const showValidity = isVisible(line, "show_validity");
  const showMap = isVisible(line, "show_map");
  const showWaypoints = isVisible(line, "show_waypoints");
  const showSchedules = isVisible(line, "show_schedules");
  const showMedia = isVisible(line, "show_media");

  const tabs = [
    showMap && { value: "map", label: "Mapa", Icon: MapPin },
    showWaypoints && { value: "route", label: "Orientações", Icon: Volume2 },
    showSchedules && { value: "schedules", label: "Horários", Icon: Clock },
    showMedia && { value: "media", label: "Mídia", Icon: ImageIcon },
  ].filter(Boolean) as { value: string; label: string; Icon: typeof MapPin }[];

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Portal
          </Link>
          {showNumber && (
            <div className="ml-2 rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary">
              {String(line.number).padStart(3, "0")}
            </div>
          )}
          {showName && <h1 className="truncate text-sm font-semibold">{line.name}</h1>}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Hero */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid gap-6 md:grid-cols-3"
        >
          <div className="md:col-span-2">
            {showNumber && (
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Linha</p>
            )}
            {showName && (
              <h2 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">{line.name}</h2>
            )}
            {line.description && <p className="mt-3 text-muted-foreground">{line.description}</p>}

            <div className="mt-5 flex flex-wrap gap-3 text-xs">
              {showFare && line.fare != null && <Pill icon={Tag} label={`R$ ${Number(line.fare).toFixed(2)}`} />}
              {showConsortium && line.consortium && <Pill icon={Building2} label={line.consortium} />}
              {showDelegatary && line.delegatary && <Pill icon={Building2} label={line.delegatary} />}
              {showValidity && line.validity_date && <Pill icon={Calendar} label={`Vigência ${new Date(line.validity_date).toLocaleDateString("pt-BR")}`} />}
            </div>
          </div>

          {line.cover_image_url && (
            <div className="overflow-hidden rounded-2xl border border-border">
              <img src={line.cover_image_url} alt={line.name} className="h-full w-full object-cover" />
            </div>
          )}
        </motion.section>

        {/* Notifications */}
        {notifs.length > 0 && (
          <section className="mt-8 space-y-2">
            {notifs.map((n) => (
              <NotificationCard key={n.id} title={n.title} message={n.message} priority={n.priority} />
            ))}
          </section>
        )}

        {/* Tabs (only if any tab is visible) */}
        {tabs.length > 0 && (
          <Tabs defaultValue={tabs[0].value} className="mt-8">
            <TabsList className="bg-surface/50">
              {tabs.map(({ value, label, Icon }) => (
                <TabsTrigger key={value} value={value}>
                  <Icon className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />{label}
                </TabsTrigger>
              ))}
            </TabsList>

            {showMap && (
              <TabsContent value="map" className="mt-4 space-y-4">
                <div className="h-[60vh] overflow-hidden rounded-2xl border border-border">
                  <Suspense fallback={<div className="grid h-full place-items-center font-mono text-xs uppercase text-muted-foreground">Carregando mapa…</div>}>
                    <RouteMap waypoints={waypoints.map((w) => ({
                      id: w.id, lat: w.lat, lng: w.lng,
                      instruction: w.instruction, maneuver: w.maneuver_type,
                      suggestedGear: w.suggested_gear ?? "", maxSpeed: w.max_speed ?? 0,
                      observation: w.observation ?? "",
                    }))} />
                  </Suspense>
                </div>
                <ActionsBar line={line} waypoints={waypoints} />
                <ObservationForm lineId={line.id} />
              </TabsContent>
            )}

            {showWaypoints && (
              <TabsContent value="route" className="mt-4">
                <WaypointList waypoints={waypoints} />
              </TabsContent>
            )}

            {showSchedules && (
              <TabsContent value="schedules" className="mt-4">
                <SchedulesView schedules={schedules} />
              </TabsContent>
            )}

            {showMedia && (
              <TabsContent value="media" className="mt-4 space-y-6">
                {images.length === 0 && videos.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma mídia cadastrada.</p>
                )}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {images.map((m) => (
                      <figure key={m.id} className="overflow-hidden rounded-xl border border-border">
                        <img src={m.url} alt={m.caption ?? ""} className="aspect-video w-full object-cover" />
                        {m.caption && <figcaption className="p-2 text-xs text-muted-foreground">{m.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                )}
                {videos.map((v) => (
                  <div key={v.id} className="overflow-hidden rounded-xl border border-border">
                    <VideoEmbed url={v.url} />
                    {v.caption && <p className="p-2 text-xs text-muted-foreground">{v.caption}</p>}
                  </div>
                ))}
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* If map tab is hidden, still show actions + observation form below the hero */}
        {!showMap && (
          <section className="mt-8 space-y-4">
            <ActionsBar line={line} waypoints={waypoints} />
            <ObservationForm lineId={line.id} />
          </section>
        )}
      </main>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: typeof Tag; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3 py-1 backdrop-blur">
      <Icon className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
      {label}
    </span>
  );
}

function NotificationCard({ title, message, priority }: { title: string; message: string; priority: "info" | "warning" | "critical" }) {
  const tone = priority === "critical" ? "destructive" : priority === "warning" ? "warning" : "primary";
  const Icon = priority === "critical" ? AlertCircle : priority === "warning" ? AlertTriangle : Info;
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-${tone}/30 bg-${tone}/10 p-3`}>
      <Icon className={`mt-0.5 h-4 w-4 text-${tone}`} strokeWidth={1.5} />
      <div className="flex-1 text-sm">
        <strong className="font-semibold">{title}</strong>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

// ─── Actions bar (PDF, video, WhatsApp, Maps) ───
function ActionsBar({ line, waypoints }: { line: LineRow; waypoints: WaypointRow[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const publicUrl = typeof window !== "undefined" ? window.location.href : "";

  const downloadPDF = async () => {
    setBusy("pdf");
    try {
      const win = window.open("", "_blank");
      if (!win) throw new Error("Bloqueador de pop-ups");
      const wpRows = waypoints
        .map(
          (w, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(w.instruction)}</td><td>${escapeHtml(maneuverLabel(w.maneuver_type))}</td><td>${w.suggested_gear ?? ""}</td><td>${w.max_speed ?? ""}</td></tr>`
        )
        .join("");
      win.document.write(`
        <html><head><title>Linha ${line.number} — ${escapeHtml(line.name)}</title>
        <style>
          body{font-family:-apple-system,system-ui,sans-serif;padding:32px;color:#111;}
          h1{font-size:22px;margin:0 0 4px;} h2{font-size:13px;color:#666;margin:0 0 24px;font-weight:500;}
          table{width:100%;border-collapse:collapse;font-size:12px;}
          th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top;}
          th{background:#f9fafb;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.05em;color:#555;}
          .meta{display:flex;gap:16px;font-size:11px;color:#555;margin-bottom:16px;}
        </style></head><body>
        <h1>Linha ${String(line.number).padStart(3, "0")} — ${escapeHtml(line.name)}</h1>
        <h2>${escapeHtml(line.description ?? "")}</h2>
        <div class="meta">
          ${line.fare != null ? `<span>Tarifa: R$ ${Number(line.fare).toFixed(2)}</span>` : ""}
          ${line.consortium ? `<span>Consórcio: ${escapeHtml(line.consortium)}</span>` : ""}
          ${line.delegatary ? `<span>Operação: ${escapeHtml(line.delegatary)}</span>` : ""}
        </div>
        <table><thead><tr><th>#</th><th>Instrução</th><th>Manobra</th><th>Marcha</th><th>Vel. máx</th></tr></thead>
        <tbody>${wpRows || '<tr><td colspan="5" style="color:#888">Sem orientações cadastradas.</td></tr>'}</tbody></table>
        <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
        </body></html>`);
      win.document.close();
    } catch (e) {
      toast.error("Falha ao gerar PDF: " + (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const downloadVideo = async () => {
    // Lazy fetch first video media
    setBusy("video");
    try {
      const list = await fetchMedia(line.id);
      const v = list.find((m) => m.type === "video");
      if (!v) {
        toast.info("Nenhum vídeo cadastrado para esta linha.");
        return;
      }
      window.open(v.url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shareWhatsApp = () => {
    const text = `Linha ${String(line.number).padStart(3, "0")} — ${line.name}\n${publicUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const openInMaps = () => {
    if (waypoints.length === 0) {
      toast.info("Linha sem pontos cadastrados.");
      return;
    }
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const wps = waypoints.slice(1, -1).slice(0, 23); // Google Maps limit is 25 stops total
    const wpStr = wps.map((w) => `${w.lat},${w.lng}`).join("|");
    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&origin=${origin.lat},${origin.lng}` +
      `&destination=${destination.lat},${destination.lng}` +
      (wpStr ? `&waypoints=${encodeURIComponent(wpStr)}` : "") +
      `&travelmode=driving`;
    window.open(url, "_blank");
  };

  const Btn = ({ id, Icon, label, onClick }: { id: string; Icon: typeof FileDown; label: string; onClick: () => void }) => (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy === id}
      className="h-9 gap-2 rounded-full border-border/70 bg-background/80 px-4 text-xs font-medium text-foreground backdrop-blur transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      {label}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface/40 p-3">
      <span className="px-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        Ações
      </span>
      <Btn id="pdf" Icon={FileDown} label="Baixar PDF" onClick={downloadPDF} />
      <Btn id="video" Icon={Video} label="Baixar vídeo" onClick={downloadVideo} />
      <Btn id="wa" Icon={Share2} label="Compartilhar WhatsApp" onClick={shareWhatsApp} />
      <Btn id="maps" Icon={Navigation} label="Abrir no Maps" onClick={openInMaps} />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ─── Observation form (driver → manager inbox) ───
function ObservationForm({ lineId }: { lineId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true);
    try {
      await submitObservation(lineId, t);
      toast.success("Observação enviada ao gestor");
      setText("");
    } catch (e) {
      toast.error("Falha ao enviar: " + (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send(); }}
      className="flex items-center gap-2 rounded-2xl border border-border bg-surface/40 p-3"
    >
      <MessageSquare className="ml-1 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enviar observação ao gestor (ex.: obra, desvio, sugestão)…"
        maxLength={500}
        className="h-9 flex-1 border-0 bg-transparent text-sm focus-visible:ring-0"
      />
      <Button type="submit" size="sm" disabled={sending || !text.trim()} className="h-9 gap-1.5 rounded-full px-4">
        <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
        Enviar
      </Button>
    </form>
  );
}

function WaypointList({ waypoints }: { waypoints: WaypointRow[] }) {
  const { speak, stop } = useSpeech();
  const [playing, setPlaying] = useState<string | null>(null);

  if (waypoints.length === 0)
    return <p className="text-sm text-muted-foreground">Nenhuma orientação cadastrada.</p>;

  return (
    <ol className="space-y-2">
      {waypoints.map((w, i) => {
        const Icon = maneuverIcon[w.maneuver_type] ?? MapPin;
        const isPlaying = playing === w.id;
        return (
          <li key={w.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-4">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
              <Icon className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span>#{String(i + 1).padStart(2, "0")}</span>
                <span>·</span>
                <span>{maneuverLabel(w.maneuver_type)}</span>
                {w.suggested_gear && <><span>·</span><span>{w.suggested_gear}</span></>}
                {w.max_speed != null && <><span>·</span><span>{w.max_speed} km/h</span></>}
              </div>
              <p className="mt-1 text-sm">{w.instruction}</p>
              {w.observation && <p className="mt-1 text-xs text-muted-foreground">{w.observation}</p>}
            </div>
            <Button
              size="sm"
              variant={isPlaying ? "default" : "outline"}
              onClick={() => {
                if (isPlaying) { stop(); setPlaying(null); }
                else { speak(w.instruction, { priority: true }); setPlaying(w.id); }
              }}
            >
              <Volume2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        );
      })}
    </ol>
  );
}

function SchedulesView({ schedules }: { schedules: import("@/lib/api").ScheduleRow[] }) {
  if (schedules.length === 0)
    return <p className="text-sm text-muted-foreground">Quadro de horários ainda não cadastrado.</p>;

  const dayLabel: Record<string, string> = {
    util: "Dia útil", sabado: "Sábado", ferias: "Dia útil (férias)", atipico: "Dia útil (atípico)",
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {schedules.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-surface/40 p-4">
          <h3 className="font-semibold">{dayLabel[s.day_type]}</h3>
          <div className="mt-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Partidas do PC</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {s.departures.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
              {s.departures.map((t, i) => (
                <span key={i} className="rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs text-primary">{t}</span>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Frota por hora</p>
            <div className="mt-2 grid grid-cols-12 gap-1">
              {Array.from({ length: 24 }).map((_, h) => {
                const v = s.fleet_per_hour?.[String(h)] ?? 0;
                return (
                  <div key={h} className="text-center">
                    <div
                      className="mx-auto rounded-sm bg-primary/30"
                      style={{ height: `${Math.max(4, v * 8)}px`, opacity: v > 0 ? 0.4 + v * 0.2 : 0.15 }}
                    />
                    <span className="block font-mono text-[8px] text-muted-foreground">{String(h).padStart(2, "0")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoEmbed({ url }: { url: string }) {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (ytMatch) {
    return (
      <div className="aspect-video w-full">
        <iframe
          src={`https://www.youtube.com/embed/${ytMatch[1]}`}
          title="Vídeo"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <video src={url} controls className="aspect-video w-full bg-black" />
  );
}
