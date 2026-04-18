import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
  useMap,
} from "react-leaflet";
import type { Waypoint } from "@/lib/storage";

// Disable default icons (we use divIcon)
delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;

interface RouteMapProps {
  waypoints: Waypoint[];
  editable?: boolean;
  onAddWaypoint?: (lat: number, lng: number) => void;
  onMoveWaypoint?: (id: string, lat: number, lng: number) => void;
  busPosition?: { lat: number; lng: number } | null;
  selectedWaypointId?: string | null;
  onSelectWaypoint?: (id: string) => void;
}

function ClickHandler({
  onAdd,
}: {
  onAdd?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onAdd?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ waypoints }: { waypoints: Waypoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (waypoints.length === 0) return;
    const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lng]));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }, [waypoints, map]);
  return null;
}

function FollowBus({ pos }: { pos: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.panTo([pos.lat, pos.lng], { animate: true, duration: 0.8 });
  }, [pos, map]);
  return null;
}

function makeMarkerIcon(label: string, kind: "start" | "end" | "mid") {
  return L.divIcon({
    className: "",
    html: `<div class="ra-marker ${kind}">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function makeBusIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="ra-bus-marker">
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
    </div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export default function RouteMap({
  waypoints,
  editable,
  onAddWaypoint,
  onMoveWaypoint,
  busPosition,
  selectedWaypointId,
  onSelectWaypoint,
}: RouteMapProps) {
  const center: [number, number] =
    waypoints.length > 0
      ? [waypoints[0].lat, waypoints[0].lng]
      : [-21.7642, -43.3496];
  const polyline = waypoints.map((w) => [w.lat, w.lng]) as [number, number][];
  const busIconRef = useRef(makeBusIcon());

  return (
    <MapContainer
      center={center}
      zoom={14}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {editable && <ClickHandler onAdd={onAddWaypoint} />}
      <FitBounds waypoints={waypoints} />
      {busPosition && <FollowBus pos={busPosition} />}

      {polyline.length > 1 && (
        <Polyline
          positions={polyline}
          pathOptions={{
            color: "oklch(0.68 0.19 245)",
            weight: 5,
            opacity: 0.85,
          }}
        />
      )}

      {waypoints.map((w, i) => {
        const kind: "start" | "end" | "mid" =
          i === 0 ? "start" : i === waypoints.length - 1 ? "end" : "mid";
        const label = String(i + 1);
        const isSelected = selectedWaypointId === w.id;
        return (
          <Marker
            key={w.id}
            position={[w.lat, w.lng]}
            draggable={editable}
            icon={makeMarkerIcon(label, kind)}
            eventHandlers={{
              click: () => onSelectWaypoint?.(w.id),
              dragend: (e) => {
                const m = e.target as L.Marker;
                const ll = m.getLatLng();
                onMoveWaypoint?.(w.id, ll.lat, ll.lng);
              },
            }}
            opacity={isSelected ? 1 : 0.95}
          />
        );
      })}

      {busPosition && (
        <Marker
          position={[busPosition.lat, busPosition.lng]}
          icon={busIconRef.current}
          interactive={false}
        />
      )}
    </MapContainer>
  );
}
