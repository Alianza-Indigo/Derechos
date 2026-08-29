"use client";

import { useEffect, useId } from "react";
import type { DelegateLocationPing, Territory } from "@/lib/types";

export function LeafletMap({ pings, territories }: { pings: DelegateLocationPing[]; territories: Territory[] }) {
  const id = useId().replaceAll(":", "");

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let disposed = false;

    async function init() {
      const L = await import("leaflet");
      if (disposed) return;
      const target = document.getElementById(id);
      if (!target || target.dataset.ready) return;
      target.dataset.ready = "true";
      map = L.map(target, { scrollWheelZoom: false }).setView([28.9, -106.2], 6);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "OpenStreetMap",
      }).addTo(map);
      for (const territory of territories) {
        L.circleMarker([territory.latitude, territory.longitude], {
          radius: territory.type === "state" ? 10 : 6,
          color: "#0f766e",
          fillColor: "#14b8a6",
          fillOpacity: 0.35,
        }).addTo(map).bindPopup(territory.name);
      }
      for (const ping of pings) {
        L.marker([ping.latitude, ping.longitude]).addTo(map).bindPopup(`${ping.status} - ${new Date(ping.capturedAt).toLocaleString("es-MX")}`);
      }
    }

    init();
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [id, pings, territories]);

  return <div id={id} className="h-96 w-full overflow-hidden rounded-lg border border-slate-200" />;
}
