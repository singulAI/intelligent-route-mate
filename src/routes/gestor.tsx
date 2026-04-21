import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  LogOut, ShieldAlert, Eye, EyeOff, Pencil, Download,
  FileJson, FileSpreadsheet, ChevronRight, RefreshCw,
  MessageSquare, Check, Trash2, Inbox,
} from "lucide-react";
import Papa from "papaparse";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fetchObservations, type LineRow, type ObservationRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/gestor")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel de Gestão — RA Routes" }] }),
  component: GestorIndex,
});

interface LineWithCount extends LineRow {
  waypoint_count: number;
}

async function fetchAdminLines(): Promise<LineWithCount[]> {
  const { data, error } = await supabase
    .from("lines")
    .select("*, waypoints(count)")
    .order("number", { ascending: true });
  if (error) throw error;
  type Row = LineRow & { waypoints: { count: number }[] };
  return (data as Row[] | null ?? []).map((l) => ({
    ...l, waypoint_count: l.waypoints?.[0]?.count ?? 0,
  }));
}

function GestorIndex() {
  const { session, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !session) {
      toast.info("Use Ctrl+Shift+G para abrir o login.");
      navigate({ to: "/" });
    }
  }, [loading, session, navigate]);

  const linesQ = useQuery({
    queryKey: ["admin-lines"],
    queryFn: fetchAdminLines,
    enabled: !!session && isAdmin,
  });

  if (loading) return <FullPageMessage>Carregando…</FullPageMessage>;

  if (!session) return <FullPageMessage>Redirecionando…</FullPageMessage>;

  if (!isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-6">
        <div className="glass max-w-md rounded-2xl p-6 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-warning" />
          <h1 className="mt-3 text-xl font-semibold">Acesso negado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta ainda não tem perfil de administrador. Solicite ao gestor principal que adicione seu papel{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">admin</code> em{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs">user_roles</code>.
          </p>
          <p className="mt-3 break-all text-[11px] font-mono text-muted-foreground">
            Seu user_id: {session.user.id}
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/" })} className="flex-1">Voltar</Button>
            <Button variant="destructive" onClick={() => signOut()} className="flex-1">
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const lines = linesQ.data ?? [];
  const published = lines.filter((l) => l.published).length;
  const draft = lines.filter((l) => !l.published && l.waypoint_count > 0).length;
  const empty = lines.length - published - draft;

  const handleImportJSON = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const routes = data.routes ?? data;
      if (!Array.isArray(routes)) throw new Error("JSON inválido");

      let created = 0;
      for (const r of routes) {
        const num = Number(r.number ?? r.line_number ?? r.numero);
        if (!Number.isFinite(num)) continue;
        const { data: line } = await supabase.from("lines").upsert({
          number: num,
          name: r.name ?? "Linha importada",
          description: r.description ?? null,
          fare: r.fare ?? null,
          published: r.published ?? false,
        }, { onConflict: "number" }).select().single();

        if (line && Array.isArray(r.waypoints)) {
          await supabase.from("waypoints").delete().eq("line_id", line.id);
          const wps = r.waypoints.map((w: Record<string, unknown>, i: number) => ({
            line_id: line.id,
            position: (w.position as number) ?? i + 1,
            lat: w.lat as number,
            lng: w.lng as number,
            instruction: (w.instruction as string) ?? "",
            maneuver_type: (w.maneuver ?? w.maneuver_type ?? "straight") as string,
            suggested_gear: (w.suggestedGear ?? w.suggested_gear ?? null) as string | null,
            max_speed: (w.maxSpeed ?? w.max_speed ?? null) as number | null,
            observation: (w.observation ?? null) as string | null,
          }));
          if (wps.length > 0) await supabase.from("waypoints").insert(wps);
        }
        created++;
      }
      toast.success(`${created} linha(s) importada(s) do JSON`);
      qc.invalidateQueries({ queryKey: ["admin-lines"] });
    } catch (e) {
      toast.error("Falha na importação JSON: " + (e as Error).message);
    }
  };

  const handleImportCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          // Group rows by line_number
          const grouped = new Map<number, Record<string, string>[]>();
          for (const row of result.data as Record<string, string>[]) {
            const num = Number(row.line_number);
            if (!Number.isFinite(num)) continue;
            if (!grouped.has(num)) grouped.set(num, []);
            grouped.get(num)!.push(row);
          }

          for (const [num, rows] of grouped) {
            const first = rows[0];
            const { data: line } = await supabase.from("lines").upsert({
              number: num,
              name: first.line_name || "Linha importada",
            }, { onConflict: "number" }).select().single();
            if (!line) continue;
            await supabase.from("waypoints").delete().eq("line_id", line.id);
            const wps = rows.map((r, i) => ({
              line_id: line.id,
              position: Number(r.waypoint_position) || i + 1,
              lat: Number(r.lat),
              lng: Number(r.lng),
              instruction: r.instruction ?? "",
              maneuver_type: r.maneuver || "straight",
              suggested_gear: r.gear || null,
              max_speed: r.max_speed ? Number(r.max_speed) : null,
              observation: r.observation || null,
            }));
            if (wps.length > 0) await supabase.from("waypoints").insert(wps);
          }
          toast.success(`${grouped.size} linha(s) importada(s) do CSV`);
          qc.invalidateQueries({ queryKey: ["admin-lines"] });
        } catch (e) {
          toast.error("Falha CSV: " + (e as Error).message);
        }
      },
      error: (err) => toast.error("Erro CSV: " + err.message),
    });
  };

  const downloadCSVTemplate = () => {
    const csv = "line_number,line_name,waypoint_position,lat,lng,instruction,maneuver,gear,max_speed,observation\n474,Linha 474,1,-21.7642,-43.3496,Início do percurso,start,1ª,20,Atenção pedestres\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "modelo-rotas.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground">Gestor</div>
            <span className="text-sm font-semibold">Painel de Gestão</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground md:inline">{session.user.email}</span>
            <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/" })}>Portal</Button>
            <Button size="sm" variant="outline" onClick={() => signOut()}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <StatCard label="Publicadas" value={published} tone="success" />
          <StatCard label="Em rascunho" value={draft} tone="warning" />
          <StatCard label="Vazias" value={empty} tone="muted" />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <input
            id="import-json" type="file" accept="application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportJSON(f); e.target.value = ""; }}
          />
          <input
            id="import-csv" type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportCSV(f); e.target.value = ""; }}
          />
          <Button size="sm" variant="outline" onClick={() => document.getElementById("import-json")?.click()}>
            <FileJson className="mr-1.5 h-3.5 w-3.5" /> Importar JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => document.getElementById("import-csv")?.click()}>
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Importar CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={downloadCSVTemplate}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Modelo CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={() => qc.invalidateQueries({ queryKey: ["admin-lines"] })}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Recarregar
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {lines.map((l) => (
            <motion.div key={l.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Link
                to="/gestor/$lineId" params={{ lineId: l.id }}
                className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/50"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/15 font-mono text-sm font-bold text-primary">
                  {String(l.number).padStart(3, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.name || "Sem nome"}</p>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {l.waypoint_count} pontos · {l.published ? "publicada" : l.waypoint_count > 0 ? "rascunho" : "vazia"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {l.published ? <Eye className="h-4 w-4 text-success" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  <Pencil className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <ObservationsInbox lines={lines} />
      </main>
    </div>
  );
}

// ─── Observations inbox ───
function ObservationsInbox({ lines }: { lines: LineWithCount[] }) {
  const qc = useQueryClient();
  const obsQ = useQuery({
    queryKey: ["admin-observations"],
    queryFn: fetchObservations,
  });
  const [filter, setFilter] = useState<"all" | "unread">("unread");

  const lineMap = new Map(lines.map((l) => [l.id, l]));
  const all = obsQ.data ?? [];
  const list = filter === "unread" ? all.filter((o) => !o.read) : all;
  const unreadCount = all.filter((o) => !o.read).length;

  const markRead = async (o: ObservationRow) => {
    const { error } = await supabase.from("observations").update({ read: !o.read }).eq("id", o.id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-observations"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta observação?")) return;
    const { error } = await supabase.from("observations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-observations"] });
  };

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-3">
        <Inbox className="h-4 w-4 text-primary" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold">Observações dos motoristas</h2>
        {unreadCount > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">
            {unreadCount}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-surface p-0.5 text-xs">
          <button
            onClick={() => setFilter("unread")}
            className={`rounded-full px-3 py-1 transition-colors ${filter === "unread" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Não lidas
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-3 py-1 transition-colors ${filter === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            Todas
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {list.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-surface/30 p-6 text-center text-xs text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 h-5 w-5 opacity-40" strokeWidth={1.5} />
            {filter === "unread" ? "Nenhuma observação não lida." : "Nenhuma observação recebida ainda."}
          </div>
        )}
        {list.map((o) => {
          const line = o.line_id ? lineMap.get(o.line_id) : null;
          return (
            <div
              key={o.id}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                o.read ? "border-border bg-surface/30" : "border-primary/30 bg-primary/5"
              }`}
            >
              {line && (
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 font-mono text-xs font-bold text-primary">
                  {String(line.number).padStart(3, "0")}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm">{o.message}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {line ? line.name : "Sem linha"} · {new Date(o.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => markRead(o)} title={o.read ? "Marcar como não lida" : "Marcar como lida"}>
                <Check className={`h-4 w-4 ${o.read ? "text-success" : "text-muted-foreground"}`} strokeWidth={1.5} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(o.id)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "muted" }) {
  const colors = {
    success: "text-success",
    warning: "text-warning",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}
