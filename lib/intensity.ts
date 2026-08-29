// Escala de intensidad para el mapa de prevalencia: convierte un valor y su
// maximo en un radio y color proporcionales. Funcion pura para poder probarla.
export type IntensityStyle = { ratio: number; radius: number; color: string; fillOpacity: number };

const RAMP = ["#fde68a", "#fbbf24", "#f59e0b", "#ea580c", "#b91c1c"];

export function intensityStyle(value: number, max: number): IntensityStyle {
  const safeMax = max > 0 ? max : 1;
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const radius = 8 + Math.round(ratio * 22);
  const color = RAMP[Math.min(RAMP.length - 1, Math.floor(ratio * RAMP.length))];
  const fillOpacity = 0.25 + ratio * 0.5;
  return { ratio, radius, color, fillOpacity };
}
