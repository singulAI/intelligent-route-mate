// Backend access layer — typed queries for lines, waypoints, media, etc.
import { supabase } from "@/integrations/supabase/client";

export type ManeuverType =
  | "start"
  | "right"
  | "left"
  | "straight"
  | "highway"
  | "exit"
  | "terminal"
  | "uturn"
  | "merge"
  | "end";

export interface LineRow {
  id: string;
  number: number;
  name: string;
  description: string | null;
  fare: number | null;
  consortium: string | null;
  delegatary: string | null;
  validity_date: string | null;
  cover_image_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface WaypointRow {
  id: string;
  line_id: string;
  position: number;
  lat: number;
  lng: number;
  instruction: string;
  maneuver_type: ManeuverType;
  suggested_gear: string | null;
  max_speed: number | null;
  observation: string | null;
}

export interface MediaRow {
  id: string;
  line_id: string;
  type: "image" | "video";
  url: string;
  caption: string | null;
  position: number;
}

export interface NotificationRow {
  id: string;
  line_id: string | null;
  title: string;
  message: string;
  priority: "info" | "warning" | "critical";
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface ScheduleRow {
  id: string;
  line_id: string;
  day_type: "util" | "sabado" | "ferias" | "atipico";
  departures: string[];
  fleet_per_hour: Record<string, number>;
}

// ─── Public reads ───
export async function fetchAllLines(): Promise<LineRow[]> {
  // Public reads only return published; admins also get unpublished via RLS
  const { data, error } = await supabase
    .from("lines")
    .select("*")
    .order("number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LineRow[];
}

export async function fetchLineByNumber(num: number) {
  const { data, error } = await supabase
    .from("lines")
    .select("*")
    .eq("number", num)
    .maybeSingle();
  if (error) throw error;
  return data as LineRow | null;
}

export async function fetchWaypoints(lineId: string) {
  const { data, error } = await supabase
    .from("waypoints")
    .select("*")
    .eq("line_id", lineId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WaypointRow[];
}

export async function fetchMedia(lineId: string) {
  const { data, error } = await supabase
    .from("media")
    .select("*")
    .eq("line_id", lineId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MediaRow[];
}

export async function fetchNotifications(lineId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .or(`line_id.eq.${lineId},line_id.is.null`)
    .eq("active", true)
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function fetchSchedules(lineId: string) {
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .eq("line_id", lineId);
  if (error) throw error;
  return (data ?? []) as ScheduleRow[];
}

export function maneuverLabel(m: ManeuverType): string {
  const map: Record<ManeuverType, string> = {
    start: "Início",
    right: "Direita",
    left: "Esquerda",
    straight: "Em frente",
    highway: "Rodovia",
    exit: "Saída",
    terminal: "Terminal",
    uturn: "Retorno",
    merge: "Acesso",
    end: "Fim",
  };
  return map[m];
}

// ─── Admin checks ───
export async function isCurrentUserAdmin(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (error) return false;
  return !!data;
}
