import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  ClipboardList,
  FileText,
  Gauge,
  MapPinned,
  QrCode,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";

export const APP_NAME = process.env.APP_NAME || "Derechos Humanos";
export const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || "http://localhost:3000";

export const roleLabels = {
  super_admin: "Super Admin",
  national_direction: "Direccion Nacional",
  state_coordination: "Coordinacion Estatal",
  municipal_coordination: "Coordinacion Municipal",
  territorial_delegate: "Delegado Territorial",
  field_commissioner: "Comisionado de Campo",
  case_manager: "Defensor / Gestor de Casos",
  events_team: "Equipo de Eventos",
  data_entry: "Capturista",
  member: "Miembro",
  auditor: "Auditor",
} as const;

export const navigationItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/miembros", label: "Miembros", icon: Users },
  { href: "/casos", label: "Casos", icon: ClipboardList },
  { href: "/eventos", label: "Eventos", icon: CalendarDays },
  { href: "/operacion-territorial", label: "Operacion", icon: MapPinned },
  { href: "/asistente", label: "Asistente IA", icon: Bot },
  { href: "/prevalencia", label: "Prevalencia", icon: BarChart3 },
  { href: "/reportes", label: "Reportes", icon: FileText },
  { href: "/configuracion", label: "Configuracion", icon: Settings },
  { href: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { href: "/credencial/demo-chihuahua-001", label: "QR publico", icon: QrCode },
  { href: "/operacion-territorial/geolocalizacion", label: "Mapa interno", icon: Activity },
];

export const caseCategories = [
  "Discriminacion",
  "Violencia institucional",
  "Negacion de servicios",
  "Vulneracion laboral",
  "Vulneracion educativa",
  "Accesibilidad",
  "Salud",
  "Documentacion y registro",
  "Seguimiento comunitario",
  "Otro",
] as const;

export const caseStatuses = [
  "Nuevo",
  "En revision",
  "Aceptado",
  "En seguimiento",
  "En espera de tercero",
  "Resuelto",
  "Cerrado sin accion",
  "Archivado",
] as const;

export const priorities = ["Baja", "Media", "Alta", "Urgente"] as const;

export const eventTypes = [
  "Capacitacion",
  "Foro",
  "Brigada",
  "Reunion institucional",
  "Conferencia",
  "Taller",
  "Jornada comunitaria",
  "Actividad de incidencia",
  "Firma de convenio",
  "Otro",
] as const;

export const aiProviders = [
  { key: "gemini", displayName: "Gemini", env: "GOOGLE_GENERATIVE_AI_API_KEY", defaultModel: "gemini-2.5-flash" },
  { key: "openai", displayName: "ChatGPT/OpenAI", env: "OPENAI_API_KEY", defaultModel: "gpt-5-mini" },
  { key: "anthropic", displayName: "Claude/Anthropic", env: "ANTHROPIC_API_KEY", defaultModel: "claude-sonnet-4-5" },
] as const;

export const promptScopes = ["general", "caso", "evento", "comision", "prevalencia", "reporte"] as const;
