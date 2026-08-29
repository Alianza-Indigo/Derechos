import type { ReportDefinition } from "@/lib/types";

// Catalogo estatico de reportes disponibles en la UI. No son registros de
// datos, sino la definicion de que se puede exportar y en que formato.
export const reportCatalog: ReportDefinition[] = [
  { id: "rep_members", title: "Miembros por territorio", type: "members", filters: ["territorio", "estatus", "fecha"], internal: false, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_cases", title: "Casos por categoria y estado", type: "cases", filters: ["categoria", "estado", "prioridad"], internal: false, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_urgent", title: "Casos urgentes", type: "urgent_cases", filters: ["territorio", "responsable"], internal: false, formats: ["PDF"] },
  { id: "rep_events", title: "Eventos por periodo", type: "events", filters: ["periodo", "tipo", "territorio"], internal: false, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_reach", title: "Alcance territorial", type: "territory_reach", filters: ["pais", "estado", "ciudad"], internal: false, formats: ["PDF"] },
  { id: "rep_prevalence", title: "Prevalencia por indicador", type: "prevalence", filters: ["indicador", "periodo", "territorio"], internal: false, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_checkins", title: "Comisiones y check-ins", type: "field_operations", filters: ["comision", "usuario", "periodo"], internal: true, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_ai", title: "Uso del asistente IA", type: "ai_usage", filters: ["proveedor", "modulo", "usuario"], internal: true, formats: ["CSV", "XLSX", "PDF"] },
  { id: "rep_case_pdf", title: "Ficha PDF de caso", type: "case_pdf", filters: ["caso"], internal: true, formats: ["PDF"] },
  { id: "rep_event_pdf", title: "Ficha PDF de evento", type: "event_pdf", filters: ["evento"], internal: false, formats: ["PDF"] },
];
