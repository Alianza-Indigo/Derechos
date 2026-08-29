"use client";

import { useEffect, useId } from "react";
import { intensityStyle } from "@/lib/intensity";
import type { DelegateLocationPing, Territory } from "@/lib/types";

export type IntensityPoint = { latitude: number; longitude: number; name: string; value: number };

export function LeafletMap({
  pings,
  territories,
  intensity,
}: {
  pings: DelegateLocationPing[];
  territories: Territory[];
  intensity?: IntensityPoint[];
}) {
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
      // La rueda hace zoom solo cuando el cursor esta sobre el mapa; al salir,
      // el scroll vuelve a mover la pagina (no se queda atrapado en el mapa).
      map.on("mouseover", () => map?.scrollWheelZoom.enable());
      map.on("mouseout", () => map?.scrollWheelZoom.disable());
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "OpenStreetMap",
      }).addTo(map);

      if (intensity && intensity.length) {
        // Mapa de intensidad: circulo ponderado por el valor medido.
        const max = Math.max(...intensity.map((point) => point.value), 0);
        for (const point of intensity) {
          const style = intensityStyle(point.value, max);
          L.circleMarker([point.latitude, point.longitude], {
            radius: style.radius,
            color: style.color,
            fillColor: style.color,
            fillOpacity: style.fillOpacity,
            weight: 1,
          })
            .addTo(map)
            .bindPopup(`${point.name}: ${Math.round(point.value)}`);
        }
      } else {
        for (const territory of territories) {
          L.circleMarker([territory.latitude, territory.longitude], {
            radius: territory.type === "state" ? 10 : 6,
            color: "#0f766e",
            fillColor: "#14b8a6",
            fillOpacity: 0.35,
          }).addTo(map).bindPopup(territory.name);
        }
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
  }, [id, pings, territories, intensity]);

  return <div id={id} className="h-96 w-full overflow-hidden rounded-lg border border-slate-200" />;
}
