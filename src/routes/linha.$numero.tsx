import { lazy, Suspense, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, MapPin, Clock, Bell, Volume2, Image as ImageIcon,
  Calendar, Tag, Building2, AlertTriangle, Info, AlertCircle,
} from "lucide-react";
import {
  fetchLineByNumber, fetchWaypoints, fetchMedia, fetchNotifications,
  fetchSchedules, maneuverLabel, type WaypointRow,
} from "@/lib/api";
import { maneuverIcon } from "@/lib/maneuverIcons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSpeech } from "@/hooks/useSpeech";

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

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Portal
          </Link>
          <div className="ml-2 rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary">
            {String(line.number).padStart(3, "0")}
          </div>
          <h1 className="truncate text-sm font-semibold">{line.name}</h1>
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
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Linha</p>
            <h2 className="mt-1 text-3xl font-bold leading-tight md:text-4xl">{line.name}</h2>
            {line.description && <p className="mt-3 text-muted-foreground">{line.description}</p>}

            <div className="mt-5 flex flex-wrap gap-3 text-xs">
              {line.fare != null && <Pill icon={Tag} label={`R$ ${Number(line.fare).toFixed(2)}`} />}
              {line.consortium && <Pill icon={Building2} label={line.consortium} />}
              {line.delegatary && <Pill icon={Building2} label={line.delegatary} />}
              {line.validity_date && <Pill icon={Calendar} label={`Vigência ${new Date(line.validity_date).toLocaleDateString("pt-BR")}`} />}
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

        {/* Tabs */}
        <Tabs defaultValue="map" className="mt-8">
          <TabsList className="bg-surface/50">
            <TabsTrigger value="map"><MapPin className="mr-1.5 h-3.5 w-3.5" />Mapa</TabsTrigger>
            <TabsTrigger value="route"><Volume2 className="mr-1.5 h-3.5 w-3.5" />Orientações</TabsTrigger>
            <TabsTrigger value="schedules"><Clock className="mr-1.5 h-3.5 w-3.5" />Horários</TabsTrigger>
            <TabsTrigger value="media"><ImageIcon className="mr-1.5 h-3.5 w-3.5" />Mídia</TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-4">
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
          </TabsContent>

          <TabsContent value="route" className="mt-4">
            <WaypointList waypoints={waypoints} />
          </TabsContent>

          <TabsContent value="schedules" className="mt-4">
            <SchedulesView schedules={schedules} />
          </TabsContent>

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
        </Tabs>
      </main>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: typeof Tag; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3 py-1 backdrop-blur">
      <Icon className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
      {label}
    </span>
  );
}

function NotificationCard({ title, message, priority }: { title: string; message: string; priority: "info" | "warning" | "critical" }) {
  const color = priority === "critical" ? "destructive" : priority === "warning" ? "warning" : "primary";
  const Icon = priority === "critical" ? AlertCircle : priority === "warning" ? AlertTriangle : Info;
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-${color}/30 bg-${color}/10 p-3`}>
      <Icon className={`mt-0.5 h-4 w-4 text-${color}`} />
      <div className="flex-1 text-sm">
        <strong className="font-semibold">{title}</strong>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
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
              <Icon className="h-4 w-4" strokeWidth={1.75} />
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

function SchedulesView({ schedules }: { schedules: ReturnType<typeof Array<unknown>> extends infer _ ? import("@/lib/api").ScheduleRow[] : never }) {
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
  // Detect YouTube
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
