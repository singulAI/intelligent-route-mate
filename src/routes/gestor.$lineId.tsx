import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Save, Trash2, Plus, Upload, Volume2, Eye, EyeOff,
  Image as ImageIcon, Bell, Clock, MapPin, Settings2, X, Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchLineByNumber, fetchWaypoints, fetchMedia, fetchNotifications,
  fetchSchedules, type LineRow, type WaypointRow, type ManeuverType,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSpeech } from "@/hooks/useSpeech";
import { toast } from "sonner";

const RouteMap = lazy(() => import("@/components/RouteMap"));

export const Route = createFileRoute("/gestor/$lineId")({
  ssr: false,
  head: () => ({ meta: [{ title: "Editor de linha — RA Routes" }] }),
  component: LineEditor,
});

const MANEUVERS: ManeuverType[] = ["start","right","left","straight","highway","exit","terminal","uturn","merge","end"];
const DAY_TYPES = [
  { value: "util", label: "Dia útil" },
  { value: "sabado", label: "Sábado" },
  { value: "ferias", label: "Dia útil (férias)" },
  { value: "atipico", label: "Dia útil (atípico)" },
] as const;

function LineEditor() {
  const { lineId } = Route.useParams();
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !isAdmin) navigate({ to: "/" });
  }, [loading, isAdmin, navigate]);

  const lineQ = useQuery({
    queryKey: ["edit-line", lineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lines").select("*").eq("id", lineId).single();
      if (error) throw error;
      return data as LineRow;
    },
    enabled: isAdmin,
  });

  const wpQ = useQuery({
    queryKey: ["edit-waypoints", lineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waypoints").select("*").eq("line_id", lineId).order("position");
      if (error) throw error;
      return (data ?? []) as WaypointRow[];
    },
    enabled: isAdmin,
  });

  if (loading || lineQ.isLoading) return <Loading />;
  if (!lineQ.data) return <Loading>Linha não encontrada</Loading>;
  const line = lineQ.data;
  const waypoints = wpQ.data ?? [];

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link to="/gestor" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Painel
          </Link>
          <div className="ml-2 rounded-md bg-primary/15 px-2 py-0.5 font-mono text-xs font-bold text-primary">
            {String(line.number).padStart(3, "0")}
          </div>
          <h1 className="truncate text-sm font-semibold">{line.name || "Sem nome"}</h1>
          <div className="ml-auto flex items-center gap-2">
            <PublishToggle line={line} onChange={() => qc.invalidateQueries({ queryKey: ["edit-line", lineId] })} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Tabs defaultValue="identity">
          <TabsList className="bg-surface/50">
            <TabsTrigger value="identity"><Settings2 className="mr-1.5 h-3.5 w-3.5" />Identidade</TabsTrigger>
            <TabsTrigger value="route"><MapPin className="mr-1.5 h-3.5 w-3.5" />Rota</TabsTrigger>
            <TabsTrigger value="media"><ImageIcon className="mr-1.5 h-3.5 w-3.5" />Mídia</TabsTrigger>
            <TabsTrigger value="voice"><Volume2 className="mr-1.5 h-3.5 w-3.5" />Voz</TabsTrigger>
            <TabsTrigger value="schedules"><Clock className="mr-1.5 h-3.5 w-3.5" />Horários</TabsTrigger>
            <TabsTrigger value="notifications"><Bell className="mr-1.5 h-3.5 w-3.5" />Avisos</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="mt-4">
            <IdentityTab line={line} />
          </TabsContent>
          <TabsContent value="route" className="mt-4">
            <RouteTab lineId={lineId} waypoints={waypoints} />
          </TabsContent>
          <TabsContent value="media" className="mt-4">
            <MediaTab lineId={lineId} />
          </TabsContent>
          <TabsContent value="voice" className="mt-4">
            <VoiceTab lineId={lineId} waypoints={waypoints} />
          </TabsContent>
          <TabsContent value="schedules" className="mt-4">
            <SchedulesTab lineId={lineId} />
          </TabsContent>
          <TabsContent value="notifications" className="mt-4">
            <NotificationsTab lineId={lineId} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Loading({ children }: { children?: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
      <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{children ?? "Carregando…"}</div>
    </div>
  );
}

function PublishToggle({ line, onChange }: { line: LineRow; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    const { error } = await supabase.from("lines")
      .update({ published: !line.published }).eq("id", line.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(line.published ? "Despublicada" : "Publicada"); onChange(); }
  };
  return (
    <Button size="sm" variant={line.published ? "default" : "outline"} disabled={busy} onClick={toggle}>
      {line.published ? <Eye className="mr-1.5 h-3.5 w-3.5" /> : <EyeOff className="mr-1.5 h-3.5 w-3.5" />}
      {line.published ? "Publicada" : "Rascunho"}
    </Button>
  );
}

// ─── Identity ───
function IdentityTab({ line }: { line: LineRow }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: line.name, description: line.description ?? "",
    fare: line.fare?.toString() ?? "", consortium: line.consortium ?? "",
    delegatary: line.delegatary ?? "", validity_date: line.validity_date ?? "",
    cover_image_url: line.cover_image_url ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("lines").update({
      name: form.name,
      description: form.description || null,
      fare: form.fare ? Number(form.fare) : null,
      consortium: form.consortium || null,
      delegatary: form.delegatary || null,
      validity_date: form.validity_date || null,
      cover_image_url: form.cover_image_url || null,
    }).eq("id", line.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Identidade salva"); qc.invalidateQueries({ queryKey: ["edit-line", line.id] }); }
  };

  const F = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-surface/40 p-6 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label>Nome da linha</Label>
        <Input value={form.name} onChange={F("name")} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label>Descrição</Label>
        <Textarea rows={3} value={form.description} onChange={F("description")} />
      </div>
      <div className="space-y-2"><Label>Tarifa (R$)</Label><Input type="number" step="0.01" value={form.fare} onChange={F("fare")} /></div>
      <div className="space-y-2"><Label>Vigência</Label><Input type="date" value={form.validity_date} onChange={F("validity_date")} /></div>
      <div className="space-y-2"><Label>Consórcio</Label><Input value={form.consortium} onChange={F("consortium")} /></div>
      <div className="space-y-2"><Label>Delegatária</Label><Input value={form.delegatary} onChange={F("delegatary")} /></div>
      <div className="space-y-2 md:col-span-2">
        <Label>URL da imagem de capa</Label>
        <Input value={form.cover_image_url} onChange={F("cover_image_url")} placeholder="https://…" />
      </div>
      <div className="md:col-span-2">
        <Button onClick={save} disabled={saving}>
          <Save className="mr-1.5 h-4 w-4" /> {saving ? "Salvando…" : "Salvar identidade"}
        </Button>
      </div>
    </div>
  );
}

// ─── Route (waypoints + map) ───
function RouteTab({ lineId, waypoints }: { lineId: string; waypoints: WaypointRow[] }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["edit-waypoints", lineId] });

  const addPoint = async (lat: number, lng: number) => {
    const position = waypoints.length + 1;
    const { error } = await supabase.from("waypoints").insert({
      line_id: lineId, position, lat, lng, instruction: "Novo ponto", maneuver_type: "straight",
    });
    if (error) toast.error(error.message); else { toast.success("Ponto adicionado"); refresh(); }
  };

  const movePoint = async (id: string, lat: number, lng: number) => {
    const { error } = await supabase.from("waypoints").update({ lat, lng }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  const updateWp = async (id: string, patch: Partial<WaypointRow>) => {
    const { error } = await supabase.from("waypoints").update(patch).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  };

  const deleteWp = async (id: string) => {
    if (!confirm("Excluir este ponto?")) return;
    const { error } = await supabase.from("waypoints").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); refresh(); }
  };

  const sel = waypoints.find((w) => w.id === selected) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="h-[60vh] overflow-hidden rounded-2xl border border-border">
        <Suspense fallback={<div className="grid h-full place-items-center text-xs text-muted-foreground">Carregando mapa…</div>}>
          <RouteMap
            waypoints={waypoints.map((w) => ({
              id: w.id, lat: w.lat, lng: w.lng, instruction: w.instruction,
              maneuver: w.maneuver_type, suggestedGear: w.suggested_gear ?? "",
              maxSpeed: w.max_speed ?? 0, observation: w.observation ?? "",
            }))}
            editable
            onAddWaypoint={addPoint}
            onMoveWaypoint={movePoint}
            selectedWaypointId={selected}
            onSelectWaypoint={setSelected}
          />
        </Suspense>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-surface/40 p-3">
          <p className="text-xs text-muted-foreground">Clique no mapa para adicionar pontos. Arraste marcadores para reposicionar.</p>
        </div>
        {sel ? (
          <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Ponto #{sel.position}</h3>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
            </div>
            <div><Label>Instrução</Label><Textarea rows={2} defaultValue={sel.instruction} onBlur={(e) => updateWp(sel.id, { instruction: e.target.value })} /></div>
            <div><Label>Manobra</Label>
              <Select defaultValue={sel.maneuver_type} onValueChange={(v) => updateWp(sel.id, { maneuver_type: v as ManeuverType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANEUVERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Marcha</Label><Input defaultValue={sel.suggested_gear ?? ""} onBlur={(e) => updateWp(sel.id, { suggested_gear: e.target.value || null })} /></div>
              <div><Label>Vel. máx.</Label><Input type="number" defaultValue={sel.max_speed ?? ""} onBlur={(e) => updateWp(sel.id, { max_speed: e.target.value ? Number(e.target.value) : null })} /></div>
            </div>
            <div><Label>Observação</Label><Textarea rows={2} defaultValue={sel.observation ?? ""} onBlur={(e) => updateWp(sel.id, { observation: e.target.value || null })} /></div>
            <Button size="sm" variant="destructive" onClick={() => deleteWp(sel.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button>
          </div>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-surface/40 p-2">
            {waypoints.length === 0 && <p className="p-3 text-xs text-muted-foreground">Nenhum ponto.</p>}
            {waypoints.map((w) => (
              <button key={w.id} onClick={() => setSelected(w.id)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-muted/40">
                <span className="font-mono text-xs text-primary">#{w.position}</span>
                <span className="truncate">{w.instruction || "—"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Media ───
function MediaTab({ lineId }: { lineId: string }) {
  const qc = useQueryClient();
  const mediaQ = useQuery({
    queryKey: ["edit-media", lineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("media").select("*").eq("line_id", lineId).order("position");
      if (error) throw error;
      return data ?? [];
    },
  });
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");

  const uploadImage = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${lineId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("line-media").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("line-media").getPublicUrl(path);
    const { error } = await supabase.from("media").insert({
      line_id: lineId, type: "image", url: urlData.publicUrl, position: (mediaQ.data?.length ?? 0) + 1,
    });
    setUploading(false);
    if (error) toast.error(error.message);
    else { toast.success("Imagem enviada"); qc.invalidateQueries({ queryKey: ["edit-media", lineId] }); }
  };

  const addVideo = async () => {
    if (!videoUrl) return;
    const { error } = await supabase.from("media").insert({
      line_id: lineId, type: "video", url: videoUrl, caption: videoCaption || null,
      position: (mediaQ.data?.length ?? 0) + 1,
    });
    if (error) toast.error(error.message);
    else { toast.success("Vídeo adicionado"); setVideoUrl(""); setVideoCaption(""); qc.invalidateQueries({ queryKey: ["edit-media", lineId] }); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("media").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["edit-media", lineId] });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface/40 p-4">
        <h3 className="mb-3 font-semibold">Imagens</h3>
        <input id="img-upload" type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
        <Button size="sm" disabled={uploading} onClick={() => document.getElementById("img-upload")?.click()}>
          <Upload className="mr-1.5 h-4 w-4" /> {uploading ? "Enviando…" : "Enviar imagem"}
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-surface/40 p-4">
        <h3 className="mb-3 font-semibold">Vídeo (URL)</h3>
        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="URL (YouTube ou MP4)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
          <Input placeholder="Legenda (opcional)" value={videoCaption} onChange={(e) => setVideoCaption(e.target.value)} />
          <Button size="sm" onClick={addVideo}><Plus className="mr-1.5 h-4 w-4" />Adicionar</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {(mediaQ.data ?? []).map((m) => (
          <div key={m.id} className="relative overflow-hidden rounded-xl border border-border bg-surface/40">
            {m.type === "image" ? (
              <img src={m.url} alt="" className="aspect-video w-full object-cover" />
            ) : (
              <div className="grid aspect-video place-items-center bg-black/40 text-xs text-muted-foreground">VÍDEO</div>
            )}
            <div className="flex items-center justify-between p-2">
              <span className="truncate text-xs">{m.caption ?? m.url.slice(0, 30)}</span>
              <Button size="sm" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Voice (per-waypoint instructions) ───
function VoiceTab({ lineId, waypoints }: { lineId: string; waypoints: WaypointRow[] }) {
  const { speak, stop } = useSpeech();
  const qc = useQueryClient();

  const updateInstruction = async (id: string, instruction: string) => {
    const { error } = await supabase.from("waypoints").update({ instruction }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["edit-waypoints", lineId] });
  };

  if (waypoints.length === 0) return <p className="text-sm text-muted-foreground">Cadastre pontos da rota antes de definir orientações de voz.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Ajuste o texto que será falado em pt-BR em cada ponto. Toque o ícone para ouvir.</p>
      {waypoints.map((w) => (
        <div key={w.id} className="flex items-start gap-2 rounded-xl border border-border bg-surface/40 p-3">
          <span className="mt-2 font-mono text-xs text-primary">#{w.position}</span>
          <Textarea rows={2} className="flex-1" defaultValue={w.instruction}
            onBlur={(e) => updateInstruction(w.id, e.target.value)} />
          <Button size="sm" variant="outline" onClick={() => { stop(); speak(w.instruction, { priority: true }); }}>
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Schedules ───
function SchedulesTab({ lineId }: { lineId: string }) {
  const qc = useQueryClient();
  const sQ = useQuery({
    queryKey: ["edit-sched", lineId],
    queryFn: () => fetchSchedules(lineId),
  });

  const upsert = async (day_type: string, departures: string[], fleet: Record<string, number>) => {
    const { error } = await supabase.from("schedules").upsert({
      line_id: lineId, day_type, departures, fleet_per_hour: fleet,
    }, { onConflict: "line_id,day_type" });
    if (error) toast.error(error.message);
    else { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["edit-sched", lineId] }); }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {DAY_TYPES.map((dt) => {
        const existing = sQ.data?.find((s) => s.day_type === dt.value);
        return (
          <ScheduleEditor key={dt.value} label={dt.label}
            departures={existing?.departures ?? []}
            fleet={existing?.fleet_per_hour ?? {}}
            onSave={(d, f) => upsert(dt.value, d, f)} />
        );
      })}
    </div>
  );
}

function ScheduleEditor({ label, departures, fleet, onSave }: {
  label: string; departures: string[]; fleet: Record<string, number>;
  onSave: (d: string[], f: Record<string, number>) => void;
}) {
  const [depText, setDepText] = useState(departures.join(", "));
  const [fleetText, setFleetText] = useState(JSON.stringify(fleet));

  useEffect(() => { setDepText(departures.join(", ")); setFleetText(JSON.stringify(fleet)); }, [departures, fleet]);

  const save = () => {
    const deps = depText.split(",").map((s) => s.trim()).filter(Boolean);
    let f: Record<string, number> = {};
    try { f = JSON.parse(fleetText || "{}"); } catch { toast.error("Frota: JSON inválido"); return; }
    onSave(deps, f);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface/40 p-4">
      <h3 className="font-semibold">{label}</h3>
      <div><Label>Partidas (separadas por vírgula, ex: 05:00, 05:30)</Label>
        <Textarea rows={2} value={depText} onChange={(e) => setDepText(e.target.value)} /></div>
      <div><Label>Frota por hora (JSON: {`{"5":2,"6":2,…}`})</Label>
        <Textarea rows={2} className="font-mono text-xs" value={fleetText} onChange={(e) => setFleetText(e.target.value)} /></div>
      <Button size="sm" onClick={save}><Save className="mr-1.5 h-3.5 w-3.5" />Salvar</Button>
    </div>
  );
}

// ─── Notifications ───
function NotificationsTab({ lineId }: { lineId: string }) {
  const qc = useQueryClient();
  const nQ = useQuery({
    queryKey: ["edit-notif", lineId],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications")
        .select("*").eq("line_id", lineId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({ title: "", message: "", priority: "info" as "info" | "warning" | "critical" });

  const create = async () => {
    if (!form.title || !form.message) return;
    const { error } = await supabase.from("notifications").insert({
      line_id: lineId, title: form.title, message: form.message, priority: form.priority, active: true,
    });
    if (error) toast.error(error.message);
    else { toast.success("Aviso criado"); setForm({ title: "", message: "", priority: "info" }); qc.invalidateQueries({ queryKey: ["edit-notif", lineId] }); }
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("notifications").update({ active }).eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["edit-notif", lineId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: ["edit-notif", lineId] });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-border bg-surface/40 p-4">
        <h3 className="font-semibold">Novo aviso</h3>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <Input placeholder="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as "info" | "warning" | "critical" })}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">Informação</SelectItem>
              <SelectItem value="warning">Atenção</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea rows={2} placeholder="Mensagem" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <Button size="sm" onClick={create}><Plus className="mr-1.5 h-4 w-4" />Publicar aviso</Button>
      </div>

      <div className="space-y-2">
        {(nQ.data ?? []).map((n) => (
          <div key={n.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface/40 p-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <strong>{n.title}</strong>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">{n.priority}</span>
              </div>
              <p className="text-sm text-muted-foreground">{n.message}</p>
            </div>
            <Switch checked={n.active} onCheckedChange={(v) => toggleActive(n.id, v)} />
            <Button size="sm" variant="ghost" onClick={() => remove(n.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
