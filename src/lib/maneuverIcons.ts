import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  CornerUpLeft,
  Flag,
  LogOut,
  Merge,
  MapPinned,
  Milestone,
  Route as RouteIcon,
} from "lucide-react";
import type { ManeuverType } from "@/lib/storage";
import type { LucideIcon } from "lucide-react";

export const maneuverIcon: Record<ManeuverType, LucideIcon> = {
  start: Flag,
  right: ArrowRight,
  left: ArrowLeft,
  straight: ArrowUp,
  highway: RouteIcon,
  exit: LogOut,
  terminal: MapPinned,
  uturn: CornerUpLeft,
  merge: Merge,
  end: Milestone,
};
